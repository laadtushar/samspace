import { unstable_cache, revalidateTag } from "next/cache";
import { fillDeep, rateValues } from "@/lib/tokens";
import { safeWhatsappLink } from "@/lib/whatsapp";
import { BUILD_ID } from "@/lib/build-id";
import { log, errorFields } from "@/lib/log";
import { isNextSignal } from "@/lib/next-signals";
import { sql, dbConfigured } from "@/lib/db";
import { defaultContent, type SiteContent } from "@/lib/default-content";

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
 * Content as stored.
 *
 * Postgres, and only Postgres. This used to read the blob store, then read
 * Postgres and keep blob underneath as a fallback. Blob is gone: it was billed
 * per operation, deployments rather than visitors spent a month's allowance in
 * a fortnight, and going over pauses the store — which is how the site came to
 * be serving its shipped defaults to everyone with no booking link.
 *
 * A second store that can fail independently was never buying reliability
 * here. It bought two ways for the same question to be answered differently,
 * and a failure mode where the copy that mattered was the one that could not be
 * read.
 *
 * Nothing is caught. A database that cannot be read is a fact the caller has to
 * decide about: `publicContent` turns it into the shipped copy for a visitor,
 * and the dashboard is shown the error rather than an empty form it could save
 * over the top of.
 */
export async function getContent(): Promise<SiteContent> {
  if (!dbConfigured()) return mergeContent(null);

  const rows = (await sql()`
    select content from site_content where id = 'site'
  `) as unknown as { content: unknown }[];

  return mergeContent(rows[0]?.content ?? null);
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
    // Next's own signals go straight back up. Absorbing DYNAMIC_SERVER_USAGE is
    // how the shipped defaults ended up prerendered onto the live homepage: the
    // error is Next asking to render the route on demand instead, and answering
    // it with a fallback bakes that fallback into the deployment.
    if (isNextSignal(error)) throw error;
    log.error("content.unavailable", errorFields(error));
    return resolveContentTokens(defaultContent);
  }
}

/**
 * Stores content.
 *
 * Throws without a database rather than pretending. There is nowhere else to
 * put it now, and a save that reports success while going nowhere is worse than
 * one that fails: the editor would close, the wording would look saved, and the
 * site would keep serving what it served before.
 */
export async function saveContent(content: SiteContent): Promise<void> {
  if (!dbConfigured()) {
    throw new Error(
      "No database configured — set DATABASE_URL before saving content."
    );
  }
  await writeContentToDb(content);
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
