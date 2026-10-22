import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminPreview, adminPreviewMetadata } from "@/lib/preview";
import PreviewDocument from "@/components/PreviewDocument";

/**
 * A post as it will look, for a signed-in admin — draft or published.
 *
 * The live route, /blog/<slug>, is left knowing nothing about drafts: it is
 * statically rendered for every reader, and that is where a preview's cookie
 * check would do the most damage. Anyone not signed in gets a 404 here.
 */

// Reads the admin cookie on every request; nothing here may be prerendered.
export const dynamic = "force-dynamic";

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  return adminPreviewMetadata("post", params.slug);
}

export default async function AdminPostPreview({
  params,
}: {
  params: { slug: string };
}) {
  const target = await adminPreview("post", params.slug);
  if (!target) notFound();
  return <PreviewDocument target={target} mode="admin" />;
}
