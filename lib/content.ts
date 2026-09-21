import { unstable_cache, revalidateTag } from "next/cache";
import { fillDeep, rateValues } from "@/lib/tokens";
import { safeWhatsappLink } from "@/lib/whatsapp";
import { BUILD_ID } from "@/lib/build-id";
import { log, errorFields } from "@/lib/log";
import { sql, dbConfigured } from "@/lib/db";
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

/**
 * What a database read came back with.
 *
 * Three outcomes, not two, and the distinction is the whole reason this type
 * exists. "Stored" and "empty" are both successful reads; "unreadable" is not,
 * and treating it as empty would let a transient error copy stale blob content
 * over content the database already holds. That is silent data loss, so the
 * caller is made to tell them apart.
 */
type DbRead =
  | { state: "stored"; content: unknown }
  | { state: "empty" }
  | { state: "unreadable" };

async function contentFromDb(): Promise<DbRead> {
  try {
    const rows = (await sql()`
      select content from site_content where id = 'site'
    `) as unknown as { content: unknown }[];
    const content = rows[0]?.content;
    return content == null ? { state: "empty" } : { state: "stored", content };
  } catch (error) {
    // Reachable on a first deployment whose migration has not run yet, and on
    // any ordinary outage. Neither should take the site down on its own.
    log.error("content.db_read_failed", errorFields(error));
    return { state: "unreadable" };
  }
}

async function writeContentToDb(content: SiteContent): Promise<void> {
  await sql()`
    insert into site_content (id, content, updated_at)
    values ('site', ${JSON.stringify(content)}::jsonb, now())
    on conflict (id) do update
      set content = excluded.content, updated_at = now()
  `;
}

/**
 * Copies content out of blob the first time the database is asked for it.
 *
 * Not a convenience. Without it there is a state that loses everything: the
 * table empty and blob holding the real content, the dashboard opening on the
 * shipped defaults because the blob read failed, and the first save writing
 * those defaults in as though they were the content. The booking link, the
 * WhatsApp handle and every edited word would be gone, with nothing to show
 * that anything had been overwritten.
 *
 * Only ever called for a read that succeeded and found nothing. Best effort on
 * the way past: a failure to copy still serves what it read.
 */
async function backfillFromBlob(stored: unknown): Promise<void> {
  try {
    await writeContentToDb(mergeContent(stored));
    log.info("content.backfilled");
  } catch (error) {
    log.warn("content.backfill_failed", errorFields(error));
  }
}

/**
 * Content as stored, from wherever it lives.
 *
 * The database first, because blob is billed per operation and content is read
 * on every deployment — ten routes read it, each read is a head plus a fetch,
 * and the cache key is scoped to the build so every deployment starts cold.
 * That is what spent a monthly allowance in a fortnight, with two visitors in
 * the hour the limit was reached. A store that can be paused for going over
 * must not be the only copy of the booking link.
 *
 * Blob stays as the layer underneath, for three situations: no database
 * configured at all, which keeps a fresh clone, local development and CI
 * working exactly as before; the table still empty, where the content is copied
 * across on the way past; and a database that cannot be read, where whatever
 * blob last held is closer to the truth than the shipped defaults are.
 *
 * Both stores failing is left to throw. `publicContent` turns that into the
 * shipped copy for a visitor, while the dashboard is shown the error rather
 * than an empty form it could save over the top of.
 */
export async function getContent(): Promise<SiteContent> {
  if (!dbConfigured()) {
    return mergeContent(await readPublicJson<unknown>(CONTENT_KEY, null));
  }

  const read = await contentFromDb();
  if (read.state === "stored") return mergeContent(read.content);

  const stored = await readPublicJson<unknown>(CONTENT_KEY, null);
  // Never on "unreadable": the database may hold newer content than blob does,
  // and copying over it because one read failed is how an edit disappears.
  if (read.state === "empty" && stored !== null) await backfillFromBlob(stored);
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

/**
 * Content for a public page, which never throws.
 *
 * The storage read raises on anything that is not a 404 — a paused store, an
 * expired token, a bad gateway — and five public routes awaited it without
 * catching: the homepage, /start, the archive, every post and the feed. A
 * storage outage did not degrade this site, it took it down, and the first sign
 * would have been a 500 on the page someone books from.
 *
 * Not caught inside the cache, deliberately. `unstable_cache` stores what the
 * function returns, so catching in there would pin the shipped defaults for an
 * hour after one bad second. Out here the fallback lasts exactly as long as the
 * failure does.
 *
 * The shipped copy is a genuine floor rather than an empty page: prices,
 * crisis numbers and contact details all render, and what a visitor loses is
 * whatever was edited in the dashboard since the last deployment.
 */
export async function publicContent(): Promise<SiteContent> {
  try {
    return await getCachedContent();
  } catch (error) {
    log.error("content.unavailable", errorFields(error));
    return resolveContentTokens(defaultContent);
  }
}

/**
 * Stores content wherever it is being read from.
 *
 * Deliberately not written to both. A save has to keep working while blob is
 * paused — that is the state this move exists for — and a write to a store that
 * refuses it would fail the save and lose the edit. Once there is a database it
 * holds the copy that counts, and the blob object is left where it is as the
 * record of what the content was when the move happened.
 */
export async function saveContent(content: SiteContent): Promise<void> {
  if (dbConfigured()) {
    await writeContentToDb(content);
  } else {
    await writePublicJson(CONTENT_KEY, content);
  }
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
