import { sql } from "@/lib/db";
import { MEDIA_PREFIX } from "@/lib/media";

/**
 * Blog images, stored in Postgres.
 *
 * They used to go to the blob store, which passed its limit and began answering
 * 403 on every read. Everything else had somewhere else to be; images were the
 * one thing that did not, so they come here and the site keeps one store alive
 * instead of two.
 *
 * Bytes in a column is the right size of solution for the volume: a handful of
 * covers a year at 5 MB apiece. What makes it cheap to read is that the serving
 * route is immutable — an id never names different bytes, because an upload
 * always generates a new one — so a CDN holds it and the database is asked once.
 */

export { ALLOWED_TYPES, MAX_BYTES, MEDIA_PREFIX, imageId } from "@/lib/media";

export interface StoredImage {
  bytes: Buffer;
  contentType: string;
}

export async function saveImage(
  id: string,
  bytes: Buffer,
  contentType: string
): Promise<void> {
  await sql()`
    insert into blog_images (id, content_type, bytes, byte_size)
    values (${id}, ${contentType}, ${bytes}, ${bytes.byteLength})
  `;
}

/** The bytes, or null when nothing is stored under that id. */
export async function readImage(id: string): Promise<StoredImage | null> {
  const rows = (await sql()`
    select content_type, bytes from blog_images where id = ${id}
  `) as unknown as { content_type: string; bytes: Buffer | Uint8Array }[];

  const row = rows[0];
  if (!row) return null;
  return {
    // The two drivers hand back bytea differently — pg gives a Buffer, the Neon
    // HTTP driver a Uint8Array — and a Response needs one shape.
    bytes: Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes),
    contentType: row.content_type,
  };
}

/** The path a stored id is served at. */
export function mediaUrl(id: string): string {
  return `${MEDIA_PREFIX}${id}`;
}
