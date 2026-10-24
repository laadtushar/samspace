import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { linkPreview, linkPreviewMetadata } from "@/lib/preview";
import PreviewDocument from "@/components/PreviewDocument";

/**
 * A draft opened from a shared link. No sign-in: the link is the permission.
 *
 * A link that is malformed, unknown, wrong, expired or revoked, or whose draft
 * has since been deleted, answers the same 404 as any missing page. Nothing on
 * the way to that 404 says which of those it was.
 */

// Each request checks the link afresh, so a revoked link stops at once rather
// than when some cache happens to expire.
export const dynamic = "force-dynamic";

export function generateMetadata({
  params,
}: {
  params: { key: string };
}): Promise<Metadata> {
  return linkPreviewMetadata(params.key);
}

export default async function SharedPreview({
  params,
}: {
  params: { key: string };
}) {
  const found = await linkPreview(params.key);
  if (!found) notFound();
  return (
    <PreviewDocument
      target={found.target}
      mode="link"
      expiresAt={found.link.expiresAt}
    />
  );
}
