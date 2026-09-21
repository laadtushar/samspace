import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { dbConfigured } from "@/lib/db";
import { ALLOWED_TYPES, MAX_BYTES, imageId } from "@/lib/media";
import { mediaUrl, saveImage } from "@/lib/images";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Cover-image upload for the blog editor.
 *
 * Stored in Postgres and served from /media. It used to go to the blob store,
 * which passed its limit and answered 403 — an upload endpoint that cannot
 * write is a blog editor that cannot publish a post with a picture.
 *
 * Content type and size are checked here rather than trusted. The file input's
 * `accept` attribute is a hint to the file picker, not a control, and this
 * endpoint is directly reachable by anyone holding an admin session.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const ref = newRef();

  if (!dbConfigured()) {
    // Better to refuse than to accept bytes and drop them: the editor would
    // show a URL that never resolves, in a post that had already been saved.
    log.error("upload.no_database", { ref });
    return NextResponse.json(
      { error: "Image storage is not configured", ref },
      { status: 503 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, AVIF, GIF or SVG images are allowed" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Images must be 5 MB or smaller" },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Checked again on the real bytes: `file.size` is what the request claimed,
  // and the two are only the same when nobody is trying.
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: "Images must be 5 MB or smaller" },
      { status: 400 }
    );
  }

  const id = imageId(file.name, file.type);

  try {
    await saveImage(id, bytes, file.type);
  } catch (error) {
    log.error("upload.failed", { ref, id, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not save the image. Please try again.", ref },
      { status: 500 }
    );
  }

  log.info("upload.stored", { ref, id, bytes: bytes.byteLength });
  return NextResponse.json({ success: true, url: mediaUrl(id) });
}
