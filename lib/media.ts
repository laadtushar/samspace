/**
 * What a stored image is called and where it is served from.
 *
 * Separate from lib/images.ts, which talks to the database, so a component can
 * name a path without pulling the Postgres client into its module graph. The
 * same split exists for lib/default-content.ts and for the same reason: one
 * accidental import in a client component turns a constant into a build error.
 */

/** Upload types, mapped to the extension a stored id ends with. */
export const ALLOWED_TYPES: ReadonlyMap<string, string> = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
]);

export const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Where a stored image is served from.
 *
 * Not under /api, deliberately: next.config sets `Cache-Control: no-store` on
 * every /api path — right for an endpoint that reads a client list, and exactly
 * wrong for a picture, where it would put a database read in front of every
 * view on every page.
 */
export const MEDIA_PREFIX = "/media/";

/**
 * A name for the stored bytes, derived rather than accepted.
 *
 * The id becomes the URL, so letting the uploaded filename through would let
 * whoever is posting choose a path. A readable stem is kept because a URL that
 * says what it points at is easier to recognise in a draft, and random
 * characters are appended so two uploads of "cover.png" cannot collide and
 * quietly replace one another — older posts keep their pictures.
 */
export function imageId(originalName: string, contentType: string): string {
  const extension = ALLOWED_TYPES.get(contentType) ?? "bin";
  const stem =
    originalName
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image";
  return `${stem}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
}
