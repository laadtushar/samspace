import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import tokens from "@/brand/kit/tokens.json";
import { BRAND } from "@/lib/brand";
import { AUTHOR } from "@/lib/author";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { drawableTitle, fitTitle, parseFontMetrics, type FittedTitle, type FontMetrics } from "./text";

/**
 * The link preview for a blog post: its title, set in the site's headline
 * face, under the Samvriti.Space lockup.
 *
 * Covers are SVG, which no social app will show as a preview, so every shared
 * post used to carry the same site-wide card. This draws one per post instead.
 *
 * The post's cover art is deliberately not on it. The covers label their
 * drawings with SVG text in Georgia, and the renderer has no system fonts, so
 * the labels vanish — "what shows / what it costs" becomes two unexplained
 * lines. A cover that only works half-drawn is better left on the page.
 */

const COLOR = {
  ground: tokens.colors.cream.hex,
  ink: tokens.colors.forest.hex,
  // Clay as text on cream fails contrast; the kit's clay-ink tint is for exactly this.
  label: tokens.colors["clay-ink"].hex,
  // Sage and clay appear only as graphics: the rule and the dot.
  rule: tokens.colors.sage.hex,
  dot: tokens.colors.clay.hex,
} as const;

/** The same 1200×630 as the site-wide preview, which platforms crop least. */
export const SHARE_IMAGE_SIZE = { width: BRAND.ogImage.width, height: BRAND.ogImage.height } as const;

/** Layout, in pixels of the 1200×630 card. Exported so the tests can check the brand rules. */
export const LAYOUT = {
  padX: 88,
  padTop: 72,
  padBottom: 64,
  /** Lockup width: the kit's minimum is 120px on screen. */
  lockupWidth: 300,
  /** Space between the lockup and the title: at least the lockup's own height, well past its clear space. */
  lockupGap: 72,
  /** Air between the last line of the title and the rule, so a full box never sits on it. */
  ruleGap: 28,
  footerHeight: 64,
  title: {
    sizes: [76, 70, 64, 58, 52, 46] as const,
    lineHeight: 1.12,
  },
} as const;

export const LOCKUP_HEIGHT = (LAYOUT.lockupWidth * BRAND.lockup.height) / BRAND.lockup.width;

/** The box the title is fitted into. */
export const TITLE_BOX = {
  width: SHARE_IMAGE_SIZE.width - LAYOUT.padX * 2,
  height:
    SHARE_IMAGE_SIZE.height -
    LAYOUT.padTop -
    LOCKUP_HEIGHT -
    LAYOUT.lockupGap -
    LAYOUT.ruleGap -
    LAYOUT.footerHeight -
    LAYOUT.padBottom,
} as const;

/*
  The fonts in ./fonts, and where they came from.

  Google Fonts now publishes both families only as variable fonts, and Satori
  draws a variable font at its default instance (Cormorant's is Light 300). So
  these are static instances cut from the files in github.com/google/fonts
  (ofl/cormorantgaramond/CormorantGaramond[wght].ttf, Version 4.001;
  ofl/dmsans/DMSans[opsz,wght].ttf, Version 4.004), with fontTools:

    fonttools varLib.instancer "CormorantGaramond[wght].ttf" wght=600 --update-name-table
    fonttools varLib.instancer "DMSans[opsz,wght].ttf" opsz=14 wght=400 --update-name-table
    fonttools varLib.instancer "DMSans[opsz,wght].ttf" opsz=14 wght=500 --update-name-table

  opsz 14 is the size Google's named DM Sans instances use. Then the GPOS
  `kern` feature is dropped (fontTools.subset, keeping every glyph and every
  other feature). Satori lays a word out with unkerned advances but draws it
  kerned, so a word with a kerned pair in it — "You", "Your", "Partner" — was
  drawn narrower than its box and left a visibly wide gap after it. Without
  kerning, what is measured is what is drawn.

  Both are SIL OFL 1.1 with no Reserved Font Name, which permits modified
  copies; the licences sit beside the files.
*/
/*
  Read from disk inside the function, from paths under process.cwd(), and
  listed in next.config.mjs (outputFileTracingIncludes) so the deployment
  ships them. The alternatives do not survive a build: Next leaves SVG out of
  a function's trace on purpose (NOT_TRACEABLE in next-trace-entrypoints-plugin),
  the tracer cannot follow a bundled path.join, and `new URL("./x.ttf",
  import.meta.url)` comes out of the server bundle as a relative URL that fs
  cannot open. Each passed in tests and failed only under next start.
*/
const FONT_DIR = path.join(process.cwd(), "lib/share-image/fonts");
const FONT_PATHS = {
  serif: path.join(FONT_DIR, "CormorantGaramond-SemiBold.ttf"),
  sans: path.join(FONT_DIR, "DMSans-Regular.ttf"),
  sansMedium: path.join(FONT_DIR, "DMSans-Medium.ttf"),
} as const;

/** The kit's colour lockup exactly as the site serves it (BRAND.lockup.src): never recoloured or faded. */
export const LOCKUP_PATH = path.join(process.cwd(), "public", BRAND.lockup.src);

export interface CardAssets {
  serif: ArrayBuffer;
  sans: ArrayBuffer;
  sansMedium: ArrayBuffer;
  serifMetrics: FontMetrics;
  lockupDataUri: string;
}

let assets: Promise<CardAssets> | null = null;

/**
 * Fonts and the lockup, read from disk once per server instance.
 *
 * Bundled rather than fetched: Satori needs TTF/OTF/WOFF, not the WOFF2 that
 * next/font serves, and a share image that depends on Google Fonts being up
 * fails exactly when someone is sharing the post.
 */
export function loadCardAssets(): Promise<CardAssets> {
  assets ??= (async () => {
    const [serif, sans, sansMedium, lockup] = await Promise.all([
      readFile(FONT_PATHS.serif),
      readFile(FONT_PATHS.sans),
      readFile(FONT_PATHS.sansMedium),
      readFile(LOCKUP_PATH),
    ]);
    const buffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    return {
      serif: buffer(serif),
      sans: buffer(sans),
      sansMedium: buffer(sansMedium),
      serifMetrics: parseFontMetrics(serif),
      lockupDataUri: `data:image/svg+xml;base64,${lockup.toString("base64")}`,
    };
  })().catch((error) => {
    // A failed read must not be remembered for the life of the instance.
    assets = null;
    throw error;
  });
  return assets;
}

/**
 * The headline the card sets: the post's title when the fonts can draw it,
 * the site's tagline otherwise (and for the fallback card, which has no post).
 */
export function cardHeadline(metrics: FontMetrics, title: string | null): FittedTitle {
  const drawable = (title && drawableTitle(metrics, title)) || SITE_TAGLINE;
  return fitTitle(metrics, drawable, {
    maxWidth: TITLE_BOX.width,
    maxHeight: TITLE_BOX.height,
    sizes: LAYOUT.title.sizes,
    lineHeight: LAYOUT.title.lineHeight,
  });
}

/** Alt text for a post's preview: what the image shows, in words. */
export function shareImageAlt(title: string): string {
  return `${title} — ${AUTHOR.name} on ${SITE_NAME}`;
}

/** The host as a reader would type it. */
function displayHost(): string {
  return new URL(SITE_URL).host.replace(/^www\./, "");
}

/**
 * The card itself, as an element tree. Text goes in as React children, which
 * Satori draws as glyph outlines: nothing in a title is ever parsed as markup.
 */
export function ShareCard({ headline, lockupDataUri }: { headline: FittedTitle; lockupDataUri: string }) {
  return (
    <div
      style={{
        width: SHARE_IMAGE_SIZE.width,
        height: SHARE_IMAGE_SIZE.height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLOR.ground,
        padding: `${LAYOUT.padTop}px ${LAYOUT.padX}px ${LAYOUT.padBottom}px`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: LOCKUP_HEIGHT }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori image, not page markup */}
        <img src={lockupDataUri} width={LAYOUT.lockupWidth} height={LOCKUP_HEIGHT} />
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLOR.dot, marginRight: 14 }} />
          <div
            style={{
              fontFamily: "DM Sans",
              fontWeight: 500,
              fontSize: 18,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: COLOR.label,
            }}
          >
            Writing
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          marginTop: LAYOUT.lockupGap,
          marginBottom: LAYOUT.ruleGap,
          height: TITLE_BOX.height,
          width: TITLE_BOX.width,
        }}
      >
        {headline.lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              fontFamily: "Cormorant Garamond",
              fontWeight: 600,
              fontSize: headline.fontSize,
              lineHeight: LAYOUT.title.lineHeight,
              color: COLOR.ink,
              whiteSpace: "nowrap",
            }}
          >
            {line}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          height: LAYOUT.footerHeight,
          borderTop: `1.5px solid ${COLOR.rule}`,
          fontFamily: "DM Sans",
          fontSize: 22,
        }}
      >
        <div style={{ display: "flex", color: COLOR.ink }}>
          <div style={{ display: "flex", fontWeight: 500 }}>{AUTHOR.name}</div>
          <div style={{ display: "flex", whiteSpace: "pre" }}>{`  ·  ${AUTHOR.jobTitle}`}</div>
        </div>
        <div style={{ display: "flex", color: COLOR.label, fontWeight: 500 }}>{displayHost()}</div>
      </div>
    </div>
  );
}

/**
 * Renders the card for a title, or the brand card when `title` is null.
 * `headers` lets the caller shorten caching for the fallback.
 */
export async function renderShareCard(title: string | null, headers?: Record<string, string>): Promise<ImageResponse> {
  const a = await loadCardAssets();
  return new ImageResponse(<ShareCard headline={cardHeadline(a.serifMetrics, title)} lockupDataUri={a.lockupDataUri} />, {
    ...SHARE_IMAGE_SIZE,
    headers,
    fonts: [
      { name: "Cormorant Garamond", data: a.serif, weight: 600, style: "normal" },
      { name: "DM Sans", data: a.sans, weight: 400, style: "normal" },
      { name: "DM Sans", data: a.sansMedium, weight: 500, style: "normal" },
    ],
  });
}
