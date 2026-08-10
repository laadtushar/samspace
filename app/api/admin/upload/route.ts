import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin-guard";
import { slugify } from "@/lib/blog";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

/**
 * Cover-image upload for the blog editor.
 *
 * Content type and size are checked server-side — the file input's `accept`
 * attribute is a hint to the file picker, not a control, and this endpoint is
 * directly reachable.
 */
export async function POST(req: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, AVIF or GIF images are allowed" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Images must be 5 MB or smaller" },
      { status: 400 }
    );
  }

  const extension = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "jpg";
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "image";

  const blob = await put(`blog-images/${base}.${extension}`, file, {
    access: "public",
    // A random suffix keeps one upload from overwriting an earlier image that
    // happens to share a filename — and older posts keep their pictures.
    addRandomSuffix: true,
    contentType: file.type,
  });

  return NextResponse.json({ success: true, url: blob.url });
}
