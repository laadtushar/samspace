import {
  readConfidentialJson,
  writeConfidentialJson,
  listBlobs,
  deleteBlob,
} from "@/lib/blob";
import type { BlogPostInput } from "@/lib/validation";

/**
 * Blog storage.
 *
 * Posts are stored encrypted even though published ones end up on public
 * pages. The store serves every object from a guessable path on a public CDN,
 * so a plaintext draft would be readable by anyone who guessed its slug — the
 * status field hides a post from the site, not from storage.
 *
 * Each post is its own object: two edits saved at once must not overwrite one
 * another, and a failed read must never be able to wipe the archive.
 *
 * The slug is the identity. Renaming a slug creates a new object and removes
 * the old one, which keeps "one post, one URL" true.
 */

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Markdown. */
  content: string;
  coverImage: string;
  coverAlt: string;
  tags: string[];
  status: "draft" | "published";
  /** ISO timestamp; set the first time the post is published. */
  publishedAt: string;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
}

const POSTS_PREFIX = "blog/";

const postPath = (slug: string) => `${POSTS_PREFIX}${slug}.json`;

/** Derives a URL-safe slug from a title. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents left by NFKD
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Rough reading time, at the ~200 wpm convention. */
export function readingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** First non-heading paragraph, used when the author leaves the excerpt blank. */
export function deriveExcerpt(markdown: string, max = 200): string {
  const paragraph = markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith("#") && !block.startsWith("!["));
  if (!paragraph) return "";
  const plain = paragraph
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

async function readPost(pathname: string): Promise<BlogPost | null> {
  return readConfidentialJson<BlogPost | null>(pathname, null);
}

/** Every post, drafts included. Admin only. */
export async function getAllPosts(): Promise<BlogPost[]> {
  const blobs = await listBlobs(POSTS_PREFIX);
  const posts = await Promise.all(blobs.map((b) => readPost(b.pathname)));
  return posts
    .filter((p): p is BlogPost => p !== null)
    .sort((a, b) =>
      (b.publishedAt || b.updatedAt).localeCompare(a.publishedAt || a.updatedAt)
    );
}

/** Published posts only, newest first. Safe for public pages. */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getAllPosts();
  return posts.filter((p) => p.status === "published");
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  return readPost(postPath(slug));
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

  await writeConfidentialJson(postPath(post.slug), post);

  // A renamed slug leaves its old object behind, which would serve a stale
  // duplicate at the old URL.
  if (input.previousSlug && input.previousSlug !== post.slug) {
    await deleteBlob(postPath(input.previousSlug));
  }

  return post;
}

export async function deletePost(slug: string): Promise<void> {
  await deleteBlob(postPath(slug));
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
