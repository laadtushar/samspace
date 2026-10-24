import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminPreview, adminPreviewMetadata } from "@/lib/preview";
import PreviewDocument from "@/components/PreviewDocument";

/**
 * A page as it will look, for a signed-in admin — draft or published.
 *
 * Anyone else gets the site's ordinary 404, the same answer as for a slug that
 * was never used, so this route cannot be used to find out what is in draft.
 */

// Reads the admin cookie on every request; nothing here may be prerendered.
export const dynamic = "force-dynamic";

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  return adminPreviewMetadata("page", params.slug);
}

export default async function AdminPagePreview({
  params,
}: {
  params: { slug: string };
}) {
  const target = await adminPreview("page", params.slug);
  if (!target) notFound();
  return <PreviewDocument target={target} mode="admin" />;
}
