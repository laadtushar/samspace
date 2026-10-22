import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/validation";

/**
 * Standalone pages: their shape, and the rules for where one may live.
 *
 * Separate from lib/pages.ts for the same reason lib/blog-format.ts is separate
 * from lib/blog.ts: the dashboard is a client component and needs the slug
 * rules, while lib/pages.ts reaches Postgres and would drag the driver into the
 * browser bundle.
 */

export interface Page {
  id: string;
  slug: string;
  /** The heading on the page itself. */
  title: string;
  /** Markdown. */
  content: string;
  status: "draft" | "published";
  /** ISO timestamp; set the first time the page is published. */
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
}

/**
 * Slugs a page can never take.
 *
 * A page is served at /<slug>, the same level as every route the site already
 * has. Next would serve its own route first, so a page called "admin" would
 * never show — but it would sit in the dashboard looking published, and appear
 * in the sitemap pointing at the login screen. Refusing the name up front is
 * cheaper than explaining that later.
 *
 * Three groups:
 *   - every top-level route in app/ and every entry in public/ (a test reads
 *     both directories, so a new route that is not listed here fails CI);
 *   - framework and well-known paths that exist without a file in the repo;
 *   - names that would read as part of the site's machinery if they were a
 *     landing page, and would be confusing to give away.
 *
 * Entries with a dot or an underscore can never pass SLUG_PATTERN anyway. They
 * are listed so this reads as the complete inventory, and so a future change to
 * the pattern cannot quietly open them up.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Routes in app/
  "about",
  "admin",
  "api",
  "blog",
  "media",
  "preview",
  "start",
  "whatsapp",
  // Metadata routes Next generates from files in app/
  "apple-icon",
  "apple-icon.png",
  "favicon",
  "favicon.ico",
  "icon",
  "icon.svg",
  "manifest",
  "manifest.webmanifest",
  "opengraph-image",
  "opengraph-image.png",
  "robots",
  "robots.txt",
  "sitemap",
  "sitemap.xml",
  "twitter-image",
  "twitter-image.png",
  // Files and folders in public/
  "brand",
  "llms",
  "llms.txt",
  "priyanka",
  "priyanka.jpeg",
  "bdb330a70c804a9d88ae4ac1b71f25fc",
  "bdb330a70c804a9d88ae4ac1b71f25fc.txt",
  "google3cee98c985c30656",
  "google3cee98c985c30656.html",
  // Framework, feeds and well-known paths
  "_next",
  "_vercel",
  ".well-known",
  "well-known",
  "feed",
  "rss",
  "rss.xml",
  "static",
  "assets",
  "public",
  "index",
  "404",
  "500",
  "not-found",
  "error",
  // Machinery
  "auth",
  "login",
  "logout",
  "signin",
  "signout",
  "dashboard",
  "draft",
  "drafts",
  "page",
  "pages",
  "post",
  "posts",
]);

/** The longest slug a page may have; the same cap posts use. */
export const PAGE_SLUG_MAX = 120;

/**
 * Why a slug cannot be used, or null when it can.
 *
 * One function for the dashboard, the API and the public route, so the three
 * cannot disagree about what a valid page address is.
 */
export function pageSlugProblem(slug: string): string | null {
  if (!slug) return "Slug is required";
  if (slug.length > PAGE_SLUG_MAX) return `Slug must be ${PAGE_SLUG_MAX} characters or fewer`;
  if (!SLUG_PATTERN.test(slug)) {
    return "Slug may contain lowercase letters, numbers and hyphens only";
  }
  if (RESERVED_SLUGS.has(slug)) {
    return `"${slug}" is already a part of the site and can't be a page address`;
  }
  return null;
}

/** True when a page could be served at /<slug>. */
export function isUsablePageSlug(slug: string): boolean {
  return pageSlugProblem(slug) === null;
}

/**
 * A fact still waiting for the practitioner, written into a draft.
 *
 * Square brackets so it is unmistakable on the page, bold so it cannot be read
 * past, and one fixed form so it can be found by machine: the API refuses to
 * publish a page that still contains one. A guess about payment or
 * confidentiality that looks finished is exactly what must not go live.
 */
export function toConfirm(what: string): string {
  return `**[To confirm: ${what}]**`;
}

/** Finds every [To confirm: …] placeholder, bold or not. */
export const PLACEHOLDER_PATTERN = /\[To confirm:[^\]]*\]/gi;

/** The placeholders still in a piece of text, as written. */
export function unconfirmedPlaceholders(text: string): string[] {
  return text.match(PLACEHOLDER_PATTERN) ?? [];
}

const trimmed = (max: number) => z.string().trim().max(max);

/**
 * What the dashboard may send when saving a page.
 *
 * Kept beside the slug rules rather than in lib/validation.ts, which this file
 * already imports for SLUG_PATTERN: the reverse import as well would make the
 * two modules depend on each other.
 */
export const pageSchema = z.object({
  id: trimmed(64).optional(),
  slug: trimmed(PAGE_SLUG_MAX).superRefine((slug, ctx) => {
    const problem = pageSlugProblem(slug);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  }),
  title: trimmed(200).min(1, "Title is required"),
  content: trimmed(100_000).min(1, "Page content is required"),
  status: z.enum(["draft", "published"]).default("draft"),
  seoTitle: trimmed(200).optional().default(""),
  seoDescription: trimmed(400).optional().default(""),
}).superRefine((page, ctx) => {
  // A draft may hold placeholders; that is what drafts are for. Publishing one
  // would show "[To confirm: …]" to clients, so it is refused here, where no
  // client of the API can step around it.
  if (page.status !== "published") return;
  const fields = [page.title, page.content, page.seoTitle, page.seoDescription];
  if (fields.some((f) => unconfirmedPlaceholders(f).length > 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["status"],
      message:
        "This page still has [To confirm: …] placeholders. Replace them before publishing.",
    });
  }
});

export type PageInput = z.infer<typeof pageSchema>;
