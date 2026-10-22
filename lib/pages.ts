import { unstable_cache } from "next/cache";
import { BUILD_ID } from "@/lib/build-id";
import { bustCache } from "@/lib/content";
import { sql, dbConfigured } from "@/lib/db";
import { isUsablePageSlug, type Page, type PageInput } from "@/lib/page-format";

export type { Page } from "@/lib/page-format";

/**
 * Standalone page storage.
 *
 * The same arrangement as posts (lib/blog.ts): Postgres only, the slug is the
 * page's URL and must be unique, and a rename moves the row rather than leaving
 * a copy behind. Reads answer empty without a database so a build with no
 * connection string still renders; writes throw, because a save that goes
 * nowhere must not look like one that worked.
 */

const COLUMNS = `id, slug, title, content, status, seo_title, seo_description,
                 published_at, created_at, updated_at`;

/** null in the column is "" in the object, as with posts. */
function rowToPage(r: Record<string, unknown>): Page {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : "");
  return {
    id: String(r.id),
    slug: (r.slug as string) ?? "",
    title: (r.title as string) ?? "",
    content: (r.content as string) ?? "",
    status: r.status === "published" ? "published" : "draft",
    seoTitle: (r.seo_title as string) ?? "",
    seoDescription: (r.seo_description as string) ?? "",
    publishedAt: iso(r.published_at),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/** Every page, drafts included, most recently edited first. For the dashboard. */
export async function getAllPages(): Promise<Page[]> {
  if (!dbConfigured()) return [];
  const rows = await sql().query(
    `select ${COLUMNS} from pages order by updated_at desc`
  );
  return rows.map(rowToPage);
}

/** Any page by slug, drafts included. Never for a public route on its own. */
export async function getPageBySlug(slug: string): Promise<Page | null> {
  if (!dbConfigured()) return null;
  const rows = await sql().query(
    `select ${COLUMNS} from pages where lower(slug) = lower($1) limit 1`,
    [slug]
  );
  return rows.length > 0 ? rowToPage(rows[0]) : null;
}

/** Any page by id. What a preview link resolves through, so renames don't break it. */
export async function getPageById(id: string): Promise<Page | null> {
  if (!dbConfigured()) return null;
  const rows = await sql().query(
    `select ${COLUMNS} from pages where id = $1 limit 1`,
    [id]
  );
  return rows.length > 0 ? rowToPage(rows[0]) : null;
}

/**
 * A published page by slug — what /<slug> serves.
 *
 * A reserved or malformed slug is refused before the database is asked. Next
 * serves its own routes ahead of this one, so the check is not what keeps
 * /admin safe; it is what stops a row inserted by hand under a reserved name
 * from ever being treated as a public page, here or in the sitemap.
 */
export async function getPublishedPageBySlug(slug: string): Promise<Page | null> {
  if (!isUsablePageSlug(slug)) return null;
  const page = await getPageBySlug(slug);
  return page?.status === "published" ? page : null;
}

/**
 * Published pages only. Filtered in SQL rather than after the fact, so a draft
 * never leaves the database on this path at all.
 */
export async function getPublishedPages(): Promise<Page[]> {
  if (!dbConfigured()) return [];
  const rows = await sql().query(
    `select ${COLUMNS} from pages where status = 'published' order by updated_at desc`
  );
  return rows.map(rowToPage).filter((p) => isUsablePageSlug(p.slug));
}

export const PAGES_TAG = "site-pages";

/**
 * Published pages, read at most once an hour. The sitemap is the caller; saving
 * a page busts the tag, so a newly published page is listed straight away.
 */
export const getCachedPublishedPages = unstable_cache(
  () => getPublishedPages(),
  [PAGES_TAG, BUILD_ID],
  { tags: [PAGES_TAG], revalidate: 3600 }
);

export async function savePage(
  input: PageInput & { previousSlug?: string }
): Promise<Page> {
  if (!dbConfigured()) {
    throw new Error("No database configured — set DATABASE_URL to save pages.");
  }

  const existing = await getPageBySlug(input.previousSlug || input.slug);
  const now = new Date().toISOString();

  const page: Page = {
    id: existing?.id ?? input.id ?? crypto.randomUUID(),
    slug: input.slug,
    title: input.title,
    content: input.content,
    status: input.status,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    // Stamped the first time it goes live and left alone after, as with posts.
    publishedAt:
      existing?.publishedAt || (input.status === "published" ? now : ""),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  // The id carried over from the existing row is what turns a rename into an
  // update in place; the unique index on slug makes a clash an error.
  await sql().query(
    `insert into pages (id, slug, title, content, status, seo_title,
                        seo_description, published_at, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (id) do update set
       slug = excluded.slug,
       title = excluded.title,
       content = excluded.content,
       status = excluded.status,
       seo_title = excluded.seo_title,
       seo_description = excluded.seo_description,
       published_at = excluded.published_at,
       updated_at = excluded.updated_at`,
    [
      page.id,
      page.slug,
      page.title,
      page.content,
      page.status,
      page.seoTitle,
      page.seoDescription,
      page.publishedAt || null,
      page.createdAt,
      page.updatedAt,
    ]
  );

  bustCache(PAGES_TAG);
  return page;
}

/**
 * Deletes a page and every preview link pointing at it.
 *
 * The links would answer 404 anyway once their target is gone; removing them
 * keeps the table from collecting rows that can never do anything.
 */
export async function deletePage(slug: string): Promise<void> {
  if (!dbConfigured()) {
    throw new Error("No database configured — set DATABASE_URL to delete pages.");
  }
  const page = await getPageBySlug(slug);
  if (!page) return;
  await sql().query(
    `delete from preview_links where target_kind = 'page' and target_id = $1`,
    [page.id]
  );
  await sql().query(`delete from pages where id = $1`, [page.id]);
  bustCache(PAGES_TAG);
}
