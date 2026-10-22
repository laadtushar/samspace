/**
 * What Vercel Analytics and Speed Insights may send.
 *
 * A shared preview link carries its token in the path
 * (/preview/link/<id>.<token>), so a page view recorded there would hand a
 * working link to a third party. Nothing under /preview is reported, for the
 * same reason lib/analytics.ts keeps product analytics off it.
 */

/** Where previews live; see lib/preview.ts. */
export const PREVIEW_PATH_PREFIX = "/preview";

function isPreviewPath(pathname: string): boolean {
  return pathname === PREVIEW_PATH_PREFIX || pathname.startsWith(`${PREVIEW_PATH_PREFIX}/`);
}

/**
 * The event unchanged, or null to drop it. An address that cannot be read is
 * dropped too: an event nobody can place is worth less than the risk of it
 * carrying a token.
 */
export function withoutPreviews<T extends { url: string }>(event: T): T | null {
  let pathname: string;
  try {
    pathname = new URL(event.url).pathname;
  } catch {
    return null;
  }
  return isPreviewPath(pathname) ? null : event;
}
