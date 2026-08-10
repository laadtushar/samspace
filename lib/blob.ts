import { put, get, list, del, BlobNotFoundError } from "@vercel/blob";

/**
 * Thin JSON layer over Vercel Blob.
 *
 * Two rules this module exists to enforce:
 *
 * 1. A missing blob and a broken blob store are different things. A bare
 *    `catch { return [] }` reports an expired token as "no data", and any
 *    caller that then writes back what it read destroys the real data. Only a
 *    genuinely absent blob becomes a default; everything else throws.
 *
 * 2. Private data is read through the authenticated `get` path with the CDN
 *    cache bypassed. Public blobs are served from a guessable URL on a public
 *    CDN, which is not somewhere client records can live.
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

async function readJson<T>(
  pathname: string,
  access: "public" | "private",
  fallback: T
): Promise<T> {
  if (!storageConfigured()) return fallback;

  try {
    // useCache: false — a stale edge copy read back and rewritten silently
    // rolls data back, so reads always go to origin.
    const result = await get(pathname, { access, useCache: false });
    if (!result || result.statusCode !== 200) return fallback;
    return JSON.parse(await new Response(result.stream).text()) as T;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return fallback;
    throw error;
  }
}

/** Reads a private JSON blob. Returns `fallback` only when it genuinely does not exist. */
export function readPrivateJson<T>(pathname: string, fallback: T): Promise<T> {
  return readJson(pathname, "private", fallback);
}

/** Reads a public JSON blob. Returns `fallback` only when it genuinely does not exist. */
export function readPublicJson<T>(pathname: string, fallback: T): Promise<T> {
  return readJson(pathname, "public", fallback);
}

export async function writePrivateJson(
  pathname: string,
  data: unknown
): Promise<void> {
  await put(pathname, JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function writePublicJson(
  pathname: string,
  data: unknown
): Promise<void> {
  await put(pathname, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    // Public site content is edited from the dashboard and must go live
    // promptly; the SDK's default is a one-month CDN cache.
    cacheControlMaxAge: 60,
  });
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
