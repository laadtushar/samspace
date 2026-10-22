import { shareImageMetadata, shareImageResponse } from "@/lib/share-image/post";

/**
 * Each post's link preview (WhatsApp, LinkedIn, Facebook): its title on the
 * brand card. The drawing lives in lib/share-image; twitter-image.tsx serves
 * the same card.
 *
 * Next only uses this file when the page's generateMetadata leaves
 * openGraph.images unset — an explicit `images` on the same segment wins over
 * the file (mergeStaticMetadata in next/dist/lib/metadata/resolve-metadata.js).
 * That is why shareImage() returns no `images` key at all for an SVG cover.
 */

export const contentType = "image/png";

/** Per-post alt text; a static `alt` export could only say the same thing for every post. */
export function generateImageMetadata({ params }: { params: { slug: string } }) {
  return shareImageMetadata(params.slug);
}

export default function Image({ params }: { params: { slug: string } }) {
  return shareImageResponse(params.slug);
}
