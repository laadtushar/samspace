import { unstable_cache } from "next/cache";
import { BUILD_ID } from "@/lib/build-id";
import {
  readConfidentialJson,
  writeConfidentialJson,
  listBlobs,
  deleteBlob,
} from "@/lib/blob";
import { bustCache } from "@/lib/content";
import { sql, dbConfigured } from "@/lib/db";
import { log, errorFields, newRef } from "@/lib/log";
import type { BlogPostInput } from "@/lib/validation";
import { deriveExcerpt, type BlogPost } from "@/lib/blog-format";

// Re-exported so every existing server caller keeps one import.
export { slugify, readingMinutes, deriveExcerpt } from "@/lib/blog-format";
export type { BlogPost } from "@/lib/blog-format";

/**
 * Blog storage.
 *
 * Posts live in Postgres. They used to live in blob, one object each, which
 * meant reading the blog cost a list plus one request per post — and blob is
 * billed per request. One query returns the same rows.
 *
 * Blob is still read when there is no database configured (a fresh clone, local
 * development, CI) and while the table is still empty, so nothing breaks
 * between this deploying and the rows arriving. See backfillFromBlob.
 *
 * The slug is the identity. Renaming one moves the row rather than leaving a
 * copy behind, which keeps "one post, one URL" true.
 */

const POSTS_PREFIX = "blog/";

const postPath = (slug: string) => `${POSTS_PREFIX}${slug}.json`;

async function readPost(pathname: string): Promise<BlogPost | null> {
  return readConfidentialJson<BlogPost | null>(pathname, null);
}


// ─── Postgres ──────────────────────────────────────

const COLUMNS = `id, slug, title, excerpt, content, cover_image, cover_alt,
                 tags, status, published_at, updated_at, seo_title, seo_description`;

/**
 * A row as the application sees it.
 *
 * published_at is null in the column and "" in the object: the application has
 * always represented "never published" as an empty string, and changing that
 * would ripple through the templates and the structured data for no gain.
 */
function rowToPost(r: Record<string, unknown>): BlogPost {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : "");
  return {
    id: String(r.id),
    slug: (r.slug as string) ?? "",
    title: (r.title as string) ?? "",
    excerpt: (r.excerpt as string) ?? "",
    content: (r.content as string) ?? "",
    coverImage: (r.cover_image as string) ?? "",
    coverAlt: (r.cover_alt as string) ?? "",
    // jsonb comes back parsed from both drivers, but a hand-edited row could
    // hold anything, and one bad row must not break the whole archive.
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    status: r.status === "published" ? "published" : "draft",
    publishedAt: iso(r.published_at),
    updatedAt: iso(r.updated_at),
    seoTitle: (r.seo_title as string) ?? "",
    seoDescription: (r.seo_description as string) ?? "",
  };
}

/** Newest first, by the date the archive is ordered on. */
function byRecency(a: BlogPost, b: BlogPost): number {
  return (b.publishedAt || b.updatedAt).localeCompare(
    a.publishedAt || a.updatedAt
  );
}

async function postsFromDb(): Promise<BlogPost[]> {
  const rows = (await sql().query(
    `select ${COLUMNS} from blog_posts`
  )) as Record<string, unknown>[];
  return rows.map(rowToPost).sort(byRecency);
}

async function writePostToDb(post: BlogPost): Promise<void> {
  await sql().query(
    `insert into blog_posts (id, slug, title, excerpt, content, cover_image,
                             cover_alt, tags, status, published_at, updated_at,
                             seo_title, seo_description)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)
     on conflict (id) do update set
       slug = excluded.slug,
       title = excluded.title,
       excerpt = excluded.excerpt,
       content = excluded.content,
       cover_image = excluded.cover_image,
       cover_alt = excluded.cover_alt,
       tags = excluded.tags,
       status = excluded.status,
       published_at = excluded.published_at,
       updated_at = excluded.updated_at,
       seo_title = excluded.seo_title,
       seo_description = excluded.seo_description`,
    [
      post.id,
      post.slug,
      post.title,
      post.excerpt,
      post.content,
      post.coverImage,
      post.coverAlt,
      JSON.stringify(post.tags),
      post.status,
      post.publishedAt || null,
      post.updatedAt,
      post.seoTitle,
      post.seoDescription,
    ]
  );
}

/**
 * Copies whatever is still in blob into the table, once.
 *
 * Without this there is a window where the table is empty and blob is not: the
 * first edit after deploying would write one row, reads would switch to the
 * database because it is no longer empty, and every other post would vanish
 * from the site. Rather than leave that to a button someone has to remember to
 * press, the first read that finds an empty table fills it.
 *
 * Safe to race: the insert ignores a slug that is already there, so two
 * requests arriving together cannot produce duplicates. Safe to fail: the
 * caller falls back to serving the posts it read from blob.
 */
async function backfillFromBlob(posts: BlogPost[]): Promise<void> {
  const ref = newRef();
  for (const post of posts) {
    await sql().query(
      `insert into blog_posts (id, slug, title, excerpt, content, cover_image,
                               cover_alt, tags, status, published_at,
                               updated_at, seo_title, seo_description)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)
       on conflict do nothing`,
      [
        post.id,
        post.slug,
        post.title,
        post.excerpt,
        post.content,
        post.coverImage,
        post.coverAlt,
        JSON.stringify(post.tags),
        post.status,
        post.publishedAt || null,
        post.updatedAt || new Date().toISOString(),
        post.seoTitle,
        post.seoDescription,
      ]
    );
  }
  log.info("blog.backfilled", { ref, count: posts.length });
}

// ─── Blob, for as long as it is still needed ───────

async function postsFromBlob(): Promise<BlogPost[]> {
  const blobs = await listBlobs(POSTS_PREFIX);
  const posts = await Promise.all(blobs.map((b) => readPost(b.pathname)));
  return posts.filter((p): p is BlogPost => p !== null).sort(byRecency);
}

/**
 * Every post, drafts included. Admin only.
 *
 * Database first. Blob only when there is no database at all, or while the
 * table is still empty — and in that second case the rows are copied across on
 * the way past, so it happens once.
 */
export async function getAllPosts(): Promise<BlogPost[]> {
  if (!dbConfigured()) return postsFromBlob();

  const stored = await postsFromDb();
  if (stored.length > 0) return stored;

  // Empty table: either nothing has ever been written, or this is the first
  // read after the move. Blob answers both.
  const fromBlob = await postsFromBlob();
  if (fromBlob.length === 0) return [];

  try {
    await backfillFromBlob(fromBlob);
  } catch (error) {
    // The posts are still correct; only the copy failed. Serving them matters
    // more than where they came from, and the next read tries again.
    log.error("blog.backfill_failed", { ...errorFields(error) });
  }
  return fromBlob;
}

/** Published posts only, newest first. Safe for public pages. */
export const POSTS_TAG = "blog-posts";

/**
 * Published posts, read from storage at most once an hour.
 *
 * This is the costly one: a list, then one read per post. Seven posts is eight
 * blob requests, and the homepage, the archive, every post page, the sitemap
 * and the feed all call it. Publishing busts the tag, so a new post still goes
 * live the moment it is published.
 */
export const getCachedPublishedPosts = unstable_cache(
  () => getPublishedPosts(),
  // Same reason as site content: a post's shape is code, not just data.
  [POSTS_TAG, BUILD_ID],
  { tags: [POSTS_TAG], revalidate: 3600 }
);

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getAllPosts();
  return posts.filter((p) => p.status === "published");
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!dbConfigured()) return readPost(postPath(slug));

  const rows = (await sql().query(
    `select ${COLUMNS} from blog_posts where lower(slug) = lower($1) limit 1`,
    [slug]
  )) as Record<string, unknown>[];
  if (rows.length > 0) return rowToPost(rows[0]);

  // Not in the table. Before the backfill has run that is expected rather than
  // a missing post, so blob still answers — and going through getAllPosts means
  // the trip also performs the copy.
  const all = await getAllPosts();
  return all.find((p) => p.slug.toLowerCase() === slug.toLowerCase()) ?? null;
}

/** Published post by slug — what the public route should use. */
export async function getPublishedPostBySlug(
  slug: string
): Promise<BlogPost | null> {
  const post = await getPostBySlug(slug);
  return post?.status === "published" ? post : null;
}

export async function savePost(
  input: BlogPostInput & { previousSlug?: string }
): Promise<BlogPost> {
  const existing = await getPostBySlug(input.previousSlug || input.slug);
  const now = new Date().toISOString();

  const post: BlogPost = {
    id: existing?.id ?? input.id ?? crypto.randomUUID(),
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt || deriveExcerpt(input.content),
    content: input.content,
    coverImage: input.coverImage,
    coverAlt: input.coverAlt,
    tags: input.tags,
    status: input.status,
    // publishedAt is stamped once, the first time it goes live, so re-editing a
    // published post doesn't keep bumping it to the top of the archive.
    publishedAt:
      input.publishedAt ||
      existing?.publishedAt ||
      (input.status === "published" ? now : ""),
    updatedAt: now,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
  };

  if (dbConfigured()) {
    /*
      A rename moves the row rather than writing a second one: the id is
      carried over from the existing post above, so this updates in place and
      the old slug simply stops existing. The unique index on slug is what
      makes a clash an error rather than a silent overwrite of someone else's
      post.
    */
    await writePostToDb(post);
  } else {
    await writeConfidentialJson(postPath(post.slug), post);
    // Without a database the old object is a real file, and leaving it behind
    // would serve a stale duplicate at the old URL.
    if (input.previousSlug && input.previousSlug !== post.slug) {
      await deleteBlob(postPath(input.previousSlug));
    }
  }

  bustCache(POSTS_TAG);
  return post;
}

export async function deletePost(slug: string): Promise<void> {
  if (dbConfigured()) {
    await sql().query(`delete from blog_posts where lower(slug) = lower($1)`, [
      slug,
    ]);
    /*
      The blob copy goes too, when there is one. Leaving it would mean a post
      deleted from the dashboard reappearing the next time the table was empty
      — which the backfill above makes a reachable state, not a theoretical
      one. A missing object is not an error here.
    */
    await deleteBlob(postPath(slug)).catch(() => {});
  } else {
    await deleteBlob(postPath(slug));
  }
  bustCache(POSTS_TAG);
}

/** Distinct tags across published posts, most used first. */
export async function getPublishedTags(): Promise<string[]> {
  const posts = await getPublishedPosts();
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}
