import { unstable_cache, revalidateTag } from "next/cache";
import { fillDeep, rateValues } from "@/lib/tokens";
import { safeWhatsappLink } from "@/lib/whatsapp";
import { BUILD_ID } from "@/lib/build-id";
import { defaultContent, type SiteContent } from "@/lib/default-content";
import {
  readConfidentialJson,
  readPublicJson,
  writeConfidentialJson,
  writePublicJson,
  listBlobs,
  deleteBlob,
} from "@/lib/blob";

// The copy and its shape live in a module with no dependencies, so the dashboard
// can import them without pulling the storage client into the browser. Server
// code keeps importing them from here.
export { defaultContent };
export type { SiteContent };

/**
 * Site content with the private contact details removed.
 *
 * Anything handed to a client component is serialised into the page, so
 * passing the whole content object put the phone number and the wa.me link
 * into the HTML whether or not either was rendered — which is exactly what
 * address harvesters read. The public pages get this shape instead, and the
 * The practitioner's own phone number never reaches the browser. The WhatsApp
 * link does, because it names a handle rather than a number.
 */
export type PublicSiteContent = Omit<SiteContent, "contact"> & {
  contact: Omit<SiteContent["contact"], "phone">;
};

export function toPublicContent(content: SiteContent): PublicSiteContent {
  const { phone: _phone, ...contact } = content.contact;
  return { ...content, contact };
}

// ─── Intake Form Submission Schema ─────────────────
export interface IntakeSubmission {
  id: string;
  timestamp: string;
  name: string;
  email: string;
  gender: string;
  age: string;
  whatsapp: string;
  education: string;
  preferredLanguage: string;
  concerns: string;
  slidingScale: string;
  /** Ticked only when a student-labelled rate was chosen. */
  studentConfirmed?: boolean;
  /** "booked" | "skipped" | "" (scheduling step not shown) */
  scheduling?: string;
}

// ─── Blob keys ─────────────────────────────────────
const CONTENT_KEY = "site-content.json";
/** Each submission is its own private blob under this prefix. */
const SUBMISSIONS_PREFIX = "submissions/";
/**
 * The single public JSON that every submission used to be appended to. Still
 * read so existing records stay visible until they are migrated off it.
 */
const LEGACY_SUBMISSIONS_KEY = "intake-submissions.json";

// ─── Site content ──────────────────────────────────

/**
 * Merges stored content over the defaults one level into each section, so a
 * partially-saved section (or a newly added field) falls back to its default
 * instead of rendering `undefined` on the live site.
 */
/**
 * Stored content over the shipped defaults, one level deep.
 *
 * Exported for the tests, which pin the property the rest of the site leans on:
 * a key the stored document has never seen is served from the defaults. That is
 * how copy added after the dashboard was first used reaches the live site at
 * all — without it, every new field would render empty until someone retyped it
 * into Settings.
 */
export function mergeContent(stored: unknown): SiteContent {
  if (!stored || typeof stored !== "object") return defaultContent;
  const isPlainObject = (v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  const defaults: Record<string, unknown> = { ...defaultContent };
  const merged: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    // Unknown keys are dropped rather than merged, so a stale or hand-edited
    // blob cannot introduce fields the site never asked for.
    if (!(key in defaults)) continue;
    const fallback = defaults[key];
    merged[key] =
      isPlainObject(fallback) && isPlainObject(value)
        ? { ...(fallback as object), ...(value as object) }
        : value;
  }

  /*
    Validating a WhatsApp link on the way in is not enough, and assuming it was
    put the practitioner's phone number back on the live site.

    The schema runs when content is saved. A document stored before the rule
    existed still holds wa.me/<number>, and because contact is merged one level
    deep that value survives untouched — so removing the field from the schema
    and then serving it publicly meant the number went straight into an href.

    Storage is the untrusted side of this boundary: anything already in it
    predates whatever rule is current. So the same check runs on the way out,
    where a stored number becomes "" and the contact card simply does not
    render.
  */
  const contact = merged.contact as SiteContent["contact"] | undefined;
  if (contact) {
    merged.contact = {
      ...contact,
      whatsappLink: safeWhatsappLink(contact.whatsappLink),
    };
  }

  return merged as unknown as SiteContent;
}

export async function getContent(): Promise<SiteContent> {
  const stored = await readPublicJson<unknown>(CONTENT_KEY, null);
  return mergeContent(stored);
}

export const CONTENT_TAG = "site-content";

/**
 * The same read, but billed once an hour instead of once per regeneration.
 *
 * Blob is metered per request, and every public page reads content. With the
 * homepage revalidating each minute that is ~1,400 reads a day from one route,
 * against a free tier of 10,000 a month — which is how the account reached 75%
 * of it in a fortnight.
 *
 * Caching on a timer alone would mean an edit taking up to an hour to show, so
 * saving busts the tag: the dashboard stays instant and the meter stays still.
 *
 * The admin dashboard deliberately keeps using getContent — it must always see
 * what is actually stored, not what was stored an hour ago.
 */
/**
 * Content with pricing tokens filled in, for the public site.
 *
 * Copy can say {{rate.range}} instead of typing the figure out, so a rate lives
 * in the rates list and nowhere else. Resolving here means every public
 * consumer gets it without knowing about tokens at all — the page, the FAQ
 * structured data, the share descriptions, the /start page.
 *
 * Deliberately not in getContent: the dashboard must see {{rate.range}} to edit
 * it. Resolving before it got there would replace the token with today's number
 * and quietly undo the arrangement the first time a FAQ answer was saved.
 */
export function resolveContentTokens(content: SiteContent): SiteContent {
  return fillDeep(content, rateValues(content.slidingScale));
}

export const getCachedContent = unstable_cache(
  async () => resolveContentTokens(await getContent()),
  // Scoped to the build: a deployment that adds a field must not keep serving
  // an object shaped by the previous one.
  [CONTENT_TAG, BUILD_ID],
  { tags: [CONTENT_TAG], revalidate: 3600 }
);

export async function saveContent(content: SiteContent): Promise<void> {
  await writePublicJson(CONTENT_KEY, content);
  bustCache(CONTENT_TAG);
}

/**
 * Clears a cache tag without letting that failure undo a successful write.
 *
 * revalidateTag throws outside a request context — a script, a test, a future
 * background job — and losing a saved edit because the cache could not be
 * cleared would be the wrong trade every time. The tag expires on its own
 * within the hour.
 */
export function bustCache(tag: string): void {
  try {
    revalidateTag(tag);
  } catch {
    // Saved either way.
  }
}

// ─── Intake submissions ────────────────────────────

/**
 * One blob per submission. The previous design appended to a single JSON
 * document, so two people submitting at once could overwrite each other, and a
 * transient read failure could replace the whole history with one record. A
 * write that only ever creates its own object cannot lose anyone else's.
 *
 * The timestamp leads the pathname, so the listing sorts newest-first without
 * opening a single file.
 */
function submissionPath(submission: IntakeSubmission): string {
  return `${SUBMISSIONS_PREFIX}${submission.timestamp}-${submission.id}.json`;
}

export async function addSubmission(
  submission: IntakeSubmission
): Promise<void> {
  await writeConfidentialJson(submissionPath(submission), submission);
}

/** Runs `fn` over items with a bounded number of blob requests in flight. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

export async function getSubmissions(): Promise<IntakeSubmission[]> {
  const [perBlob, legacy] = await Promise.all([
    listBlobs(SUBMISSIONS_PREFIX).then((blobs) =>
      mapWithConcurrency(
        blobs.map((b) => b.pathname),
        8,
        (pathname) => readConfidentialJson<IntakeSubmission | null>(pathname, null)
      )
    ),
    readLegacySubmissions(),
  ]);

  return [...perBlob.filter((s): s is IntakeSubmission => s !== null), ...legacy].sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp)
  );
}

/** The original single document, still plaintext until the migration runs. */
async function readLegacySubmissions(): Promise<IntakeSubmission[]> {
  return (
    (await readConfidentialJson<IntakeSubmission[] | null>(
      LEGACY_SUBMISSIONS_KEY,
      null
    ).catch(() => null)) ?? []
  );
}

/**
 * Removes one submission, wherever it lives.
 *
 * Records written since the per-submission change are their own object and are
 * simply deleted. Anything still inside the original combined document has to
 * be rewritten without it — which is a read-modify-write, and is only safe here
 * because that document is frozen: nothing appends to it any more.
 *
 * Returns false when no record with that id exists, so the caller can answer
 * honestly rather than reporting a delete that never happened.
 */
export async function deleteSubmission(id: string): Promise<boolean> {
  const blobs = await listBlobs(SUBMISSIONS_PREFIX);
  const match = blobs.find((b) => b.pathname.includes(id));
  if (match) {
    await deleteBlob(match.pathname);
    return true;
  }

  const legacy = await readLegacySubmissions();
  const remaining = legacy.filter((s) => s.id !== id);
  if (remaining.length === legacy.length) return false;

  await writeConfidentialJson(LEGACY_SUBMISSIONS_KEY, remaining);
  return true;
}

/**
 * Moves any records still in the single legacy blob into per-submission private
 * blobs, then deletes the legacy blob. Safe to run more than once.
 *
 * Note for whoever runs this: the legacy blob was plaintext in a public store,
 * so reading it required no credentials. Treat its contents as disclosed.
 */
export async function migrateLegacySubmissions(): Promise<{
  migrated: number;
}> {
  const legacy = await readLegacySubmissions();
  if (legacy.length === 0) return { migrated: 0 };

  for (const submission of legacy) {
    await writeConfidentialJson(submissionPath(submission), submission);
  }
  await deleteBlob(LEGACY_SUBMISSIONS_KEY);

  return { migrated: legacy.length };
}
