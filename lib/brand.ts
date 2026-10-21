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
 * The image a link to a post should preview with: its cover when the cover is
 * a raster image, otherwise the site's own preview image. Vector covers look
 * right on the page but show as a blank card when shared.
 */
export function shareImage(cover?: string | null): { url: string; width?: number; height?: number; alt?: string } {
  return cover && SHAREABLE.test(cover) ? { url: cover } : BRAND.ogImage;
}
