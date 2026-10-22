import { getPublishedPostBySlug, type BlogPost } from "@/lib/blog";
import { publicContent } from "@/lib/content";
import { publicPost } from "@/lib/posts-public";
import { SITE_TAGLINE, withoutSiteSuffix } from "@/lib/site";
import { log, errorFields } from "@/lib/log";
import { isNextSignal } from "@/lib/next-signals";
import { SHARE_IMAGE_SIZE, renderShareCard, shareImageAlt } from "./card";

/**
 * The wiring between a post and its preview image, shared by
 * app/blog/[slug]/opengraph-image.tsx and twitter-image.tsx.
 */

/**
 * The title a post is shared under: the same expression generateMetadata uses
 * for og:title, so the card and the words beside it in a link preview agree.
 */
export function shareTitle(post: Pick<BlogPost, "title" | "seoTitle">): string {
  return withoutSiteSuffix(post.seoTitle || post.title);
}

/**
 * A published post's share title, by the same lookup the page makes: the
 * published row, with {{token}}s filled from the public rates. Null for a
 * missing or unpublished post.
 */
export async function findShareTitle(slug: string): Promise<string | null> {
  const stored = await getPublishedPostBySlug(slug);
  if (!stored) return null;
  const content = await publicContent();
  return shareTitle(publicPost(stored, content.slidingScale));
}

/** The one image each route serves; Next appends it to the URL. */
export const SHARE_IMAGE_ID = "card";

/**
 * Per-post image metadata, which is how a generated image gets per-post alt
 * text: the static `alt` export and .alt.txt files are fixed strings.
 *
 * An empty list for a missing post means the image route answers 404 and the
 * not-found page offers no preview. A database error is not the same as a
 * missing post, and the page must not fail because its preview could not be
 * described, so the brand card stands in until the next regeneration.
 */
export async function shareImageMetadata(slug: string) {
  const describe = (alt: string) => [
    { id: SHARE_IMAGE_ID, alt, size: SHARE_IMAGE_SIZE, contentType: "image/png" },
  ];
  try {
    const title = await findShareTitle(slug);
    return title ? describe(shareImageAlt(title)) : [];
  } catch (error) {
    // Next's own signals (render this on demand instead) are not failures.
    if (isNextSignal(error)) throw error;
    log.error("share_image.metadata_failed", errorFields(error));
    // The brand card headlines the tagline in place of a title.
    return describe(shareImageAlt(SITE_TAGLINE));
  }
}

/**
 * The image itself.
 *
 * Missing or unpublished: 404, never a picture of a post that is not there.
 * Storage failing: the brand card, marked uncacheable so a shared link picks
 * up the real one once the database answers.
 */
export async function shareImageResponse(slug: string): Promise<Response> {
  let title: string | null;
  try {
    title = await findShareTitle(slug);
  } catch (error) {
    if (isNextSignal(error)) throw error;
    log.error("share_image.render_fallback", errorFields(error));
    return renderShareCard(null, { "cache-control": "no-store, max-age=0" });
  }
  if (!title) return new Response("Not found", { status: 404 });
  return renderShareCard(title, { "cache-control": CARD_CACHE_CONTROL });
}

/**
 * How long a rendered card may be reused.
 *
 * next/og marks every image immutable for a year, which suits a URL that
 * changes with its content. This one does not: Next's ?hash is of the route's
 * source, so a retitled post keeps its image URL. Five minutes at the CDN (the
 * same as the post page's revalidate) keeps a rename from being stuck behind a
 * year-long cache, while a burst of shares still renders the card once.
 */
const CARD_CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";
