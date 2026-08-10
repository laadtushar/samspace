import { put, get, head, list, del, BlobNotFoundError } from "@vercel/blob";

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

/**
 * Reads a private JSON blob through the authenticated path. Returns `fallback`
 * only when the blob genuinely does not exist.
 */
export async function readPrivateJson<T>(
  pathname: string,
  fallback: T
): Promise<T> {
  if (!storageConfigured()) return fallback;

  try {
    // useCache: false — a stale edge copy read back and rewritten silently
    // rolls data back, so reads always go to origin.
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return fallback;
    return JSON.parse(await new Response(result.stream).text()) as T;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return fallback;
    throw error;
  }
}

/**
 * Reads a public JSON blob.
 *
 * Public blobs are resolved with `head` and fetched from their own URL rather
 * than through `get({ access: "public" })`, which the API rejects with a 400.
 * `no-store` keeps Next's data cache from serving a stale copy after an edit.
 */
export async function readPublicJson<T>(
  pathname: string,
  fallback: T
): Promise<T> {
  if (!storageConfigured()) return fallback;

  try {
    const blob = await head(pathname);
    if (!blob) return fallback;
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 404) return fallback;
      throw new Error(`Blob fetch failed for ${pathname}: ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return fallback;
    throw error;
  }
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
