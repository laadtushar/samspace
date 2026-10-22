import type { Metadata } from "next";
import { currentAdmin } from "@/lib/auth";
import { getAllPosts, getPostBySlug, type BlogPost } from "@/lib/blog";
import { getPageById, getPageBySlug, type Page } from "@/lib/pages";
import { resolvePreviewKey, type PreviewLink } from "@/lib/preview-links";
import { pageTitle, withoutSiteSuffix } from "@/lib/site";

/**
 * Everything under /preview: who may see what, and how it is kept out of
 * search engines and caches.
 *
 * Previews live on their own routes rather than on a draft's real URL. The
 * real URLs are statically rendered and cached for every visitor; teaching
 * them to read the admin cookie would either make every post and page render
 * per request, or risk an admin's view of a draft being cached and served to
 * the next person. Under /preview nothing is cached, nothing is indexed, and
 * the public routes keep no knowledge of drafts at all.
 *
 * The headers that enforce that (X-Robots-Tag, Cache-Control,
 * Referrer-Policy) are set for the whole of /preview in next.config.mjs, so a
 * route added here later gets them without having to remember. The metadata
 * below says the same thing in the page itself.
 */

/** Never indexed, never followed, never sent as a referrer. */
export const PREVIEW_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  referrer: "no-referrer",
};

/** Metadata for anything that answers 404 here, which must not describe the draft. */
export const PREVIEW_NOT_FOUND_METADATA: Metadata = {
  ...PREVIEW_METADATA,
  title: "Page not found",
};

/** A preview's title: the search title, as it would read on the live page. */
export function previewMetadata(item: {
  title: string;
  seoTitle: string;
  seoDescription: string;
}): Metadata {
  return {
    ...PREVIEW_METADATA,
    title: pageTitle(withoutSiteSuffix(item.seoTitle || item.title)),
    description: item.seoDescription || undefined,
  };
}

export type PreviewTarget =
  | { kind: "page"; page: Page }
  | { kind: "post"; post: BlogPost };

/**
 * A post by id.
 *
 * lib/blog.ts reads by slug; a link holds the id so a rename does not break
 * it. The blog is a handful of posts, so reading them all and picking one is a
 * single cheap query rather than a reason to widen the blog module.
 */
async function getPostById(id: string): Promise<BlogPost | null> {
  return (await getAllPosts()).find((p) => p.id === id) ?? null;
}

/**
 * What a signed-in admin is previewing, or null for anyone else.
 *
 * Null for a visitor and null for a missing draft are deliberately the same:
 * both become a 404, so the route says nothing about whether a draft exists.
 */
export async function adminPreview(
  kind: "page" | "post",
  slug: string
): Promise<PreviewTarget | null> {
  if (!(await currentAdmin())) return null;
  if (kind === "page") {
    const page = await getPageBySlug(slug);
    return page ? { kind, page } : null;
  }
  const post = await getPostBySlug(slug);
  return post ? { kind, post } : null;
}

/** What a shared link opens, or null if the link does not work for any reason. */
export async function linkPreview(
  key: string
): Promise<{ link: PreviewLink; target: PreviewTarget } | null> {
  const link = await resolvePreviewKey(key);
  if (!link) return null;
  if (link.kind === "page") {
    const page = await getPageById(link.targetId);
    return page ? { link, target: { kind: "page", page } } : null;
  }
  const post = await getPostById(link.targetId);
  return post ? { link, target: { kind: "post", post } } : null;
}

const metadataFor = (target: PreviewTarget) =>
  previewMetadata(target.kind === "page" ? target.page : target.post);

/**
 * Metadata for a signed-in preview. Asked separately from the page because
 * Next renders metadata even for a 404 — and a draft's title in the <title> of
 * a not-found page would still say the draft exists.
 */
export async function adminPreviewMetadata(
  kind: "page" | "post",
  slug: string
): Promise<Metadata> {
  const target = await adminPreview(kind, slug);
  return target ? metadataFor(target) : PREVIEW_NOT_FOUND_METADATA;
}

/** Metadata for a shared link, on the same terms. */
export async function linkPreviewMetadata(key: string): Promise<Metadata> {
  const found = await linkPreview(key);
  return found ? metadataFor(found.target) : PREVIEW_NOT_FOUND_METADATA;
}
