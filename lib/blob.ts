import { put, head, list, del, BlobNotFoundError } from "@vercel/blob";
import { encryptJson, decryptJson } from "@/lib/crypto";

/**
 * Thin JSON layer over Vercel Blob.
 *
 * Three rules this module exists to enforce:
 *
 * 1. A missing blob and a broken blob store are different things. A bare
 *    `catch { return [] }` reports an expired token as "no data", and any
 *    caller that then writes back what it read destroys the real data. Only a
 *    genuinely absent blob becomes a default; everything else throws.
 *
 * 2. Records that must stay confidential are encrypted before they are written.
 *    Access level on Vercel Blob is fixed when the store is created and this
 *    project's store is public, so `access: "private"` is rejected outright —
 *    the object is fetchable by anyone holding its URL no matter what we pass.
 *    Encrypting the payload makes that URL worthless without the key.
 *
 * 3. Reads bypass the CDN cache. A stale copy read back and rewritten silently
 *    rolls data back.
 */

/**
 * "Storage isn't set up" and "storage is broken" are different failures.
 *
 * With no token there is no store to have lost anything — that's a fresh clone,
 * a CI build, or local development. Reads return their fallback so pages still
 * render; writes are left to fail loudly, because a write with nowhere to go
 * must never look like it succeeded.
 */
function storageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readRaw(pathname: string): Promise<string | null> {
  try {
    const blob = await head(pathname);
    if (!blob) return null;
    const res = await fetch(blob.url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Blob fetch failed for ${pathname}: ${res.status}`);
    }
    return await res.text();
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

async function writeRaw(
  pathname: string,
  body: string,
  cacheControlMaxAge?: number
): Promise<void> {
  await put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...(cacheControlMaxAge === undefined ? {} : { cacheControlMaxAge }),
  });
}

/**
 * Reads a confidential record. Returns `fallback` only when the blob genuinely
 * does not exist. Records written before encryption existed still read back.
 */
export async function readConfidentialJson<T>(
  pathname: string,
  fallback: T
): Promise<T> {
  if (!storageConfigured()) return fallback;
  const raw = await readRaw(pathname);
  if (raw === null) return fallback;
  return decryptJson<T>(raw);
}

/** Writes a confidential record — encrypted, so the public URL reveals nothing. */
export async function writeConfidentialJson(
  pathname: string,
  data: unknown
): Promise<void> {
  // Deliberately not cached at the edge: these are read by the dashboard and by
  // the migration, both of which need the current value.
  await writeRaw(pathname, encryptJson(data), 60);
}

/** Reads a public JSON blob. Returns `fallback` only when it does not exist. */
export async function readPublicJson<T>(
  pathname: string,
  fallback: T
): Promise<T> {
  if (!storageConfigured()) return fallback;
  const raw = await readRaw(pathname);
  if (raw === null) return fallback;
  return JSON.parse(raw) as T;
}

export async function writePublicJson(
  pathname: string,
  data: unknown
): Promise<void> {
  // Public site content is edited from the dashboard and must go live promptly;
  // the SDK's default is a one-month CDN cache.
  await writeRaw(pathname, JSON.stringify(data), 60);
}

export async function listBlobs(prefix: string) {
  if (!storageConfigured()) return [];
  const { blobs } = await list({ prefix, mode: "expanded" });
  return blobs;
}

export async function deleteBlob(pathname: string): Promise<void> {
  await del(pathname);
}

export { BlobNotFoundError };
