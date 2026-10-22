import { shareImageMetadata, shareImageResponse } from "@/lib/share-image/post";

/**
 * The same card for X, which reads twitter:image before og:image. Written out
 * rather than re-exported from opengraph-image.tsx: Next reads a metadata
 * image file's exports from its own source.
 */

export const contentType = "image/png";

export function generateImageMetadata({ params }: { params: { slug: string } }) {
  return shareImageMetadata(params.slug);
}

export default function Image({ params }: { params: { slug: string } }) {
  return shareImageResponse(params.slug);
}
