/**
 * Single source of truth for the site's own origin.
 *
 * Canonical URLs, the sitemap, robots.txt, and OG tags all have to agree, and
 * a preview deployment that claims to be production de-indexes itself into the
 * production URL. Everything derives from here instead of hardcoding the host.
 */
const PRODUCTION_URL = "https://samvritispace.com";

function resolveSiteUrl(): string {
  // An explicit override always wins — set NEXT_PUBLIC_SITE_URL when the site
  // moves to a new domain or runs somewhere other than Vercel.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  // Preview and branch deployments describe themselves, so they canonicalise to
  // their own URL rather than stealing production's.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
    if (host) return `https://${host}`;
  }

  return PRODUCTION_URL;
}

export const SITE_URL = resolveSiteUrl();

/** True only for the live production site — used to gate indexing. */
export const IS_PRODUCTION_SITE = SITE_URL === PRODUCTION_URL;

/** Absolute URL for a site-relative path, e.g. absoluteUrl("/blog") */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

export const SITE_NAME = "Samvriti.Space";
export const SITE_TAGLINE = "A space to feel seen, heard, and supported";
