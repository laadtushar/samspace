/**
 * Brand assets served from /public/brand. The masters, and the rules for which
 * one to use where, live in brand/kit (see brand/kit/README.md); these are the
 * copies the site serves. Width/height are the files' own viewBox, so layouts
 * can reserve the right space before the image loads.
 */
export const BRAND = {
  /** Horizontal lockup, for light grounds (navbar, /start). */
  lockup: { src: "/brand/lockup-horizontal-color.svg", width: 1816, height: 400 },
  /** Horizontal lockup, reversed for dark grounds (footer, admin header). */
  lockupReversed: { src: "/brand/lockup-horizontal-reversed.svg", width: 1816, height: 400 },
  /** PNG lockup for email, where SVG is not reliably shown. 1200x264, shown at 240 wide. */
  emailLogo: { src: "/brand/email-logo.png", width: 1200, height: 264 },
  /** Square PNG of the badge, for search engines' logo field (Google wants at least 112px). */
  logo512: "/brand/icon-512.png",
  manifestIcons: [
    { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  /**
   * The site-wide link preview (app/opengraph-image.png). Pages that set their
   * own openGraph replace the root one wholesale, so they name it explicitly.
   */
  ogImage: {
    url: "/opengraph-image.png",
    width: 1200,
    height: 630,
    alt: "Samvriti.Space — Priyanka Varma | Counselling Psychologist & Academic Mentor",
  },
  alt: "Samvriti.Space",
} as const;

/** Formats social apps (WhatsApp, LinkedIn, X, Facebook) show as a link preview. SVG is not one of them. */
const SHAREABLE = /\.(png|jpe?g|webp|gif)(\?.*)?$/i;

/**
 * The `images` a post's openGraph and twitter metadata should carry, to be
 * spread in: `{ ...shareImage(post.coverImage) }`.
 *
 * A raster cover is its own preview, as before. A vector cover looks right on
 * the page but shows as a blank card when shared, so instead the post's
 * generated card is used (app/blog/[slug]/opengraph-image.tsx and
 * twitter-image.tsx, its title on the brand card).
 *
 * That card only appears if the key is absent. Next drops a segment's
 * file-based image whenever that segment's own metadata has an `images`
 * property — even `images: undefined` — so this returns an empty object, not
 * an empty value, and never falls back to the site-wide BRAND.ogImage.
 */
export function shareImage(cover?: string | null): { images: { url: string }[] } | Record<string, never> {
  return cover && SHAREABLE.test(cover) ? { images: [{ url: cover }] } : {};
}
