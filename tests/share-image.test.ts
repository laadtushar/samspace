import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ReactElement } from "react";
import tokens from "@/brand/kit/tokens.json";
import { BRAND } from "@/lib/brand";
import { STARTER_POSTS } from "@/lib/starter-posts";
import { defaultContent } from "@/lib/content";
import { publicPost } from "@/lib/posts-public";
import { SITE_TAGLINE } from "@/lib/site";
import {
  LAYOUT,
  LOCKUP_HEIGHT,
  SHARE_IMAGE_SIZE,
  ShareCard,
  TITLE_BOX,
  cardHeadline,
  loadCardAssets,
  renderShareCard,
  shareImageAlt,
} from "@/lib/share-image/card";
import { shareTitle } from "@/lib/share-image/post";
import { covers, drawableTitle, fitTitle, measure, parseFontMetrics } from "@/lib/share-image/text";

/**
 * Per-post link previews (lib/share-image, app/blog/[slug]/opengraph-image.tsx).
 *
 * The card is judged by eye — see the samples block at the bottom — but the
 * things that must never happen are checked here: a title running off the
 * card, the lockup shrunk or tinted, sage or clay used as text on cream, and a
 * render quietly fetching fonts from Google because a title had an emoji in it.
 */

const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
const fontBytes = (f: string) => readFileSync(path.join(root, "lib/share-image/fonts", f));
const serif = parseFontMetrics(fontBytes("CormorantGaramond-SemiBold.ttf"));
const sans = parseFontMetrics(fontBytes("DMSans-Regular.ttf"));
const sansMedium = parseFontMetrics(fontBytes("DMSans-Medium.ttf"));

const pngSize = (buf: Buffer) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });
const png = async (res: Response) => Buffer.from(await res.arrayBuffer());

/** Every title the starter posts can be shared under, tokens filled as the page fills them. */
const starterTitles = STARTER_POSTS.flatMap((stored) => {
  const post = publicPost(stored, defaultContent.slidingScale);
  return [post.title, shareTitle(post)];
});
const LONGEST = "Long Distance Relationships When One Person Moves Abroad: What No One Prepares You For";

const fit = (title: string) =>
  fitTitle(serif, title, {
    maxWidth: TITLE_BOX.width,
    maxHeight: TITLE_BOX.height,
    sizes: LAYOUT.title.sizes,
    lineHeight: LAYOUT.title.lineHeight,
  });

describe("bundled fonts", () => {
  it("ships each font with its OFL licence", () => {
    for (const f of ["OFL-CormorantGaramond.txt", "OFL-DMSans.txt"]) {
      expect(read(`lib/share-image/fonts/${f}`), f).toContain("SIL Open Font License, Version 1.1");
    }
  });

  it("has no kerning for Satori to draw that its layout does not measure", () => {
    // Satori measures unkerned and draws kerned: a kerned font leaves wide gaps after words like "You".
    const gposFeatures = (file: string) => {
      const b = fontBytes(file);
      const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
      for (let i = 0; i < v.getUint16(4); i++) {
        const rec = 12 + i * 16;
        if (b.toString("latin1", rec, rec + 4) !== "GPOS") continue;
        const gpos = v.getUint32(rec + 8);
        const list = gpos + v.getUint16(gpos + 6);
        return Array.from({ length: v.getUint16(list) }, (_, f) => b.toString("latin1", list + 2 + f * 6, list + 6 + f * 6));
      }
      return [];
    };
    for (const f of ["CormorantGaramond-SemiBold.ttf", "DMSans-Regular.ttf", "DMSans-Medium.ttf"]) {
      expect(gposFeatures(f), f).toContain("mark"); // the table was found and read
      expect(gposFeatures(f), f).not.toContain("kern");
    }
  });

  it("can draw every starter title, the ellipsis and a rupee figure", () => {
    for (const t of starterTitles) expect(covers(serif, t), t).toBe(true);
    expect(covers(serif, "…’–—₹")).toBe(true);
    expect(covers(serif, "🌿")).toBe(false);
  });

  it("can draw the fixed text on the card", () => {
    expect(covers(sansMedium, "WRITING samvritispace.com Priyanka Varma")).toBe(true);
    expect(covers(sans, "  ·  Counselling Psychologist & Academic Mentor")).toBe(true);
    expect(covers(serif, SITE_TAGLINE)).toBe(true);
  });
});

describe("drawable titles", () => {
  it("drops decoration the fonts lack and keeps the words", () => {
    expect(drawableTitle(serif, "Anxiety 🌿 at 3am ✨")).toBe("Anxiety at 3am");
    expect(drawableTitle(serif, "Heart ❤️ and mind")).toBe("Heart and mind");
  });

  it("collapses whitespace a pasted title brings with it", () => {
    expect(drawableTitle(serif, "  Two\nlines\t pasted  ")).toBe("Two lines pasted");
  });

  it("refuses a title whose letters it cannot draw, rather than printing part of it", () => {
    expect(drawableTitle(serif, "Log Kya Kahenge (लोग क्या कहेंगे)")).toBeNull();
    expect(drawableTitle(serif, "🌿✨")).toBeNull();
  });

  it("composes decomposed accents before checking them", () => {
    expect(drawableTitle(serif, "Café talk")).toBe("Café talk");
  });
});

describe("fitting a title on the card", () => {
  const titles = [
    ...starterTitles,
    "Grief",
    "Overthinking at 3am",
    "A".repeat(120),
    Array.from({ length: 40 }, () => "word").join(" "),
    "W".repeat(30) + " " + "The quick brown fox jumps over the lazy dog ".repeat(4).trim(),
  ];

  it("never lets a line run wider, or the block taller, than the box", () => {
    for (const t of titles) {
      const { fontSize, lines } = fit(t);
      for (const line of lines) expect(measure(serif, line, fontSize), line).toBeLessThanOrEqual(TITLE_BOX.width);
      expect(lines.length * fontSize * LAYOUT.title.lineHeight, t).toBeLessThanOrEqual(TITLE_BOX.height);
    }
  });

  it("keeps every word of a title that fits, in order", () => {
    for (const t of starterTitles) expect(fit(t).lines.join(" ")).toBe(t);
  });

  it("steps the size down for long titles", () => {
    const short = fit("Grief");
    expect(short.fontSize).toBe(LAYOUT.title.sizes[0]);
    expect(fit(LONGEST).lines.join(" ")).toBe(LONGEST);
    expect(fit("Long ".repeat(30).trim()).fontSize).toBeLessThan(short.fontSize);
  });

  it("ends a title that can never fit with an ellipsis instead of overflowing", () => {
    const huge = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const { lines } = fit(huge);
    expect(lines.at(-1)).toMatch(/…$/);
  });

  it("balances lines instead of stranding one word", () => {
    // Balanced lines: none is a short stub hanging under full-width ones.
    for (const t of starterTitles) {
      const { fontSize, lines } = fit(t);
      if (lines.length < 2) continue;
      const widths = lines.map((l) => measure(serif, l, fontSize));
      expect(Math.min(...widths) / Math.max(...widths), t).toBeGreaterThan(0.5);
    }
  });
});

/** Every element in the card, with its inherited text colour. */
function walk(el: ReactElement, color: string | undefined, visit: (el: ReactElement, color?: string) => void) {
  const props = el.props as { style?: { color?: string }; children?: unknown };
  const own = props.style?.color ?? color;
  visit(el, own);
  const children = Array.isArray(props.children) ? props.children.flat() : [props.children];
  for (const child of children) {
    if (child && typeof child === "object") walk(child as ReactElement, own, visit);
    else if (typeof child === "string" && child.trim()) visit({ type: "#text", props: { children: child } } as ReactElement, own);
  }
}

describe("the card follows the brand kit", () => {
  const card = ShareCard({ headline: cardHeadline(serif, LONGEST), lockupDataUri: "data:lockup" });

  it("shows the lockup at least 120px wide, unfaded, with clear space around it", () => {
    expect(LAYOUT.lockupWidth).toBeGreaterThanOrEqual(120);
    expect(LOCKUP_HEIGHT / LAYOUT.lockupWidth).toBeCloseTo(BRAND.lockup.height / BRAND.lockup.width, 6);
    // Clear space is the wordmark's x-height; the whole lockup height is a generous bound for it.
    for (const space of [LAYOUT.padTop, LAYOUT.padX, LAYOUT.lockupGap]) {
      expect(space).toBeGreaterThanOrEqual(LOCKUP_HEIGHT);
    }
    const imgs: ReactElement[] = [];
    walk(card, undefined, (el) => el.type === "img" && imgs.push(el));
    expect(imgs).toHaveLength(1);
    const img = imgs[0].props as { width: number; style?: Record<string, unknown> };
    expect(img.width).toBe(LAYOUT.lockupWidth);
    expect(JSON.stringify(img.style ?? {})).not.toMatch(/opacity|filter/);
  });

  it("uses the kit's own colour lockup file, byte for byte", async () => {
    const { lockupDataUri } = await loadCardAssets();
    const served = readFileSync(path.join(root, "public", BRAND.lockup.src));
    expect(lockupDataUri).toBe(`data:image/svg+xml;base64,${served.toString("base64")}`);
    expect(served.toString("utf8")).toBe(read("brand/kit/logo/svg/lockup-horizontal-color.svg"));
  });

  it("never sets sage or clay as text on cream", () => {
    const allowed = new Set([tokens.colors.forest.hex, tokens.colors["clay-ink"].hex]);
    const seen: string[] = [];
    walk(card, undefined, (el, color) => {
      if (el.type === "#text") {
        expect(color, String((el.props as { children: string }).children)).toBeDefined();
        seen.push(color!);
      }
    });
    expect(seen.length).toBeGreaterThan(3);
    for (const c of seen) expect(allowed.has(c), c).toBe(true);
  });

  it("puts the title in as text, not markup", () => {
    const hostile = `<img src=x onerror=alert(1)> & "quotes"`;
    const headline = cardHeadline(serif, hostile);
    expect(headline.lines.join(" ")).toBe(hostile);
    const texts: string[] = [];
    walk(ShareCard({ headline, lockupDataUri: "x" }), undefined, (el) => {
      if (el.type === "#text") texts.push((el.props as { children: string }).children);
    });
    expect(texts.join(" ")).toContain(hostile.split(" ")[0]);
  });

  it("describes the image in its alt text", () => {
    expect(shareImageAlt("Overthinking vs Anxiety")).toBe("Overthinking vs Anxiety — Priyanka Varma on Samvriti.Space");
  });
});

describe("rendering", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("draws a 1200×630 PNG", async () => {
    const res = await renderShareCard(LONGEST);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(pngSize(await png(res))).toEqual(SHARE_IMAGE_SIZE);
  }, 30_000);

  it("never fetches a font, whatever the title holds", async () => {
    const fetch = vi.fn(() => Promise.reject(new Error("no network in a share image")));
    vi.stubGlobal("fetch", fetch);
    for (const title of ["Anxiety 🌿 at 3am ✨", "Log Kya Kahenge (लोग क्या कहेंगे)", "Fees: ₹500–₹1000 → what’s fair?", null]) {
      const res = await renderShareCard(title);
      expect(pngSize(await png(res)), String(title)).toEqual(SHARE_IMAGE_SIZE);
    }
    expect(fetch).not.toHaveBeenCalled();
  }, 60_000);

  it("falls back to the tagline on the brand card", () => {
    expect(cardHeadline(serif, null).lines.join(" ")).toBe(SITE_TAGLINE);
    expect(cardHeadline(serif, "दिल").lines.join(" ")).toBe(SITE_TAGLINE);
  });
});

describe("wiring", () => {
  it("shares under the same title the page gives og:title", () => {
    expect(read("app/blog/[slug]/page.tsx")).toContain("withoutSiteSuffix(post.seoTitle || post.title)");
    expect(shareTitle({ title: "Plain", seoTitle: "SEO title | Samvriti.Space" })).toBe("SEO title");
    expect(shareTitle({ title: "Plain", seoTitle: "" })).toBe("Plain");
  });

  it("ships its fonts and the lockup with the image functions, which Next would not trace on its own", async () => {
    const { LOCKUP_PATH } = await import("@/lib/share-image/card");
    expect(path.relative(root, LOCKUP_PATH)).toBe(path.join("public", BRAND.lockup.src));
    const config = read("next.config.mjs");
    expect(config).toContain('"/blog/*/{opengraph,twitter}-image/**": [');
    expect(config).toContain('"./lib/share-image/fonts/*.ttf",');
    expect(config).toContain(`"./public${BRAND.lockup.src}",`);
  });

  it("serves the card from both image routes, with per-post alt text and no static alt file", () => {
    for (const f of ["opengraph-image", "twitter-image"]) {
      const src = read(`app/blog/[slug]/${f}.tsx`);
      expect(src, f).toContain("export function generateImageMetadata");
      expect(src, f).toContain("shareImageResponse(params.slug)");
      // .alt.txt is only read for static images; a generated one takes alt from generateImageMetadata.
      expect(existsSync(path.join(root, `app/blog/[slug]/${f}.alt.txt`)), f).toBe(false);
    }
  });
});

/*
  Set SHARE_IMAGE_SAMPLES_DIR to write the cards for the starter posts (and the
  awkward cases) to disk and look at them. Rendering goes through the same
  function the routes call; there is deliberately no endpoint that renders
  arbitrary text.
*/
const samplesDir = process.env.SHARE_IMAGE_SAMPLES_DIR;

describe.runIf(samplesDir)("share image samples", () => {
  it("writes a card for every starter post, by title and by share title", async () => {
    mkdirSync(samplesDir!, { recursive: true });
    for (const stored of STARTER_POSTS) {
      const post = publicPost(stored, defaultContent.slidingScale);
      const variants = { share: shareTitle(post), title: post.title };
      for (const [kind, title] of Object.entries(variants)) {
        writeFileSync(path.join(samplesDir!, `${post.slug}--${kind}.png`), await png(await renderShareCard(title)));
      }
    }
    const odd = {
      fallback: null,
      "edge-200-chars": "Why ".repeat(10) + "Everything Feels Harder After Moving Abroad, and What Helps When the Calls Home Get Shorter, the Days Get Longer and Nobody Around You Knows Your Name".slice(0, 160),
      "edge-emoji": "Anxiety 🌿 at 3am ✨",
      "edge-token": publicPost({ title: "What Therapy Costs: {{rate.range}} on a Sliding Scale" }, defaultContent.slidingScale).title,
    };
    for (const [name, title] of Object.entries(odd)) {
      writeFileSync(path.join(samplesDir!, `${name}.png`), await png(await renderShareCard(title)));
    }
  }, 120_000);
});
