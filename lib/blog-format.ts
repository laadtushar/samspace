/**
 * The blog's pure pieces: its shape, and the text helpers around it.
 *
 * Separate from lib/blog.ts because the dashboard is a client component and
 * needs slugify and readingMinutes — while lib/blog.ts reaches Postgres, and
 * importing it from the browser drags the driver, and every Node built-in it
 * touches, into the client bundle. That is not a style preference: it fails the
 * build.
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
