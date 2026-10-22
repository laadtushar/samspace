/**
 * Setting a post title on a share image: which characters the bundled fonts
 * can draw, how wide a run of them is, and which size and line breaks fit.
 *
 * Pure: it takes font bytes and returns numbers, so the layout can be tested
 * without rendering anything.
 *
 * Why measure at all, rather than letting the renderer wrap? Satori wraps, but
 * it does not report overflow: a 90-character title at a headline size simply
 * runs off the bottom of the card. Measuring with the font's own advance
 * widths lets the size step down until the title fits, and lets the lines be
 * balanced instead of leaving one word stranded on the last.
 *
 * Why know which characters the fonts have? next/og fills a missing glyph by
 * downloading a font from Google Fonts at render time. A title is typed into
 * the dashboard, so an emoji in it would quietly turn an image request into a
 * call to a third party. Only characters the bundled fonts cover are drawn.
 */

export interface FontMetrics {
  unitsPerEm: number;
  /** Glyph advance in font units, or undefined when the font has no glyph. */
  advance(codePoint: number): number | undefined;
}

/**
 * Reads the two tables needed to measure text from a TrueType/OpenType file:
 * cmap (character → glyph) and hmtx (glyph → advance width).
 */
export function parseFontMetrics(bytes: Uint8Array): FontMetrics {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = new Map<string, number>();
  const numTables = view.getUint16(4);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(
      view.getUint8(rec),
      view.getUint8(rec + 1),
      view.getUint8(rec + 2),
      view.getUint8(rec + 3)
    );
    tables.set(tag, view.getUint32(rec + 8));
  }
  const table = (tag: string) => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`Font has no ${tag} table`);
    return offset;
  };

  const unitsPerEm = view.getUint16(table("head") + 18);
  const numberOfHMetrics = view.getUint16(table("hhea") + 34);
  const hmtx = table("hmtx");
  const glyphAdvance = (glyph: number) =>
    view.getUint16(hmtx + 4 * Math.min(glyph, numberOfHMetrics - 1));

  const glyphs = readCmap(view, table("cmap"));
  return {
    unitsPerEm,
    advance(codePoint) {
      const glyph = glyphs.get(codePoint);
      return glyph ? glyphAdvance(glyph) : undefined;
    },
  };
}

/** Unicode cmap subtables: format 12 (full range) preferred, then format 4 (BMP). */
function readCmap(view: DataView, cmap: number): Map<number, number> {
  const map = new Map<number, number>();
  const count = view.getUint16(cmap + 2);
  const subtables: { format: number; offset: number }[] = [];
  for (let i = 0; i < count; i++) {
    const rec = cmap + 4 + i * 8;
    const platform = view.getUint16(rec);
    const encoding = view.getUint16(rec + 2);
    const offset = cmap + view.getUint32(rec + 4);
    // Windows Unicode (3,1 / 3,10) and Unicode platform (0,*) are both Unicode.
    if (platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))) {
      subtables.push({ format: view.getUint16(offset), offset });
    }
  }

  const full = subtables.find((s) => s.format === 12);
  if (full) {
    const groups = view.getUint32(full.offset + 12);
    for (let g = 0; g < groups; g++) {
      const rec = full.offset + 16 + g * 12;
      const start = view.getUint32(rec);
      const end = view.getUint32(rec + 4);
      const glyph = view.getUint32(rec + 8);
      for (let c = start; c <= end; c++) map.set(c, glyph + (c - start));
    }
    return map;
  }

  const bmp = subtables.find((s) => s.format === 4);
  if (!bmp) throw new Error("Font has no Unicode cmap");
  const segCount = view.getUint16(bmp.offset + 6) / 2;
  const ends = bmp.offset + 14;
  const starts = ends + segCount * 2 + 2;
  const deltas = starts + segCount * 2;
  const rangeOffsets = deltas + segCount * 2;
  for (let s = 0; s < segCount; s++) {
    const end = view.getUint16(ends + s * 2);
    const start = view.getUint16(starts + s * 2);
    const delta = view.getInt16(deltas + s * 2);
    const rangeOffset = view.getUint16(rangeOffsets + s * 2);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let glyph: number;
      if (rangeOffset === 0) {
        glyph = (c + delta) & 0xffff;
      } else {
        glyph = view.getUint16(rangeOffsets + s * 2 + rangeOffset + (c - start) * 2);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) map.set(c, glyph);
    }
  }
  return map;
}

/** True when every character of `text` has a glyph in the font. */
export function covers(font: FontMetrics, text: string): boolean {
  for (const ch of text) if (font.advance(ch.codePointAt(0)!) === undefined) return false;
  return true;
}

/** Width of `text` in pixels at `fontSize`, from the font's advances (no kerning). */
export function measure(font: FontMetrics, text: string, fontSize: number): number {
  let units = 0;
  for (const ch of text) units += font.advance(ch.codePointAt(0)!) ?? 0;
  return (units / font.unitsPerEm) * fontSize;
}

/**
 * A title reduced to what the font can draw, or null when that would change
 * what it says.
 *
 * Whitespace collapses to single spaces (a title pasted with a line break
 * should not set one). Characters with no glyph are dropped when they are
 * decoration — emoji, their variation selectors and joiners, stray symbols —
 * because the words still read the same without them. A missing letter or
 * digit is different: "Log Kya Kahenge (लोग क्या कहेंगे)" minus the Devanagari
 * is not the title any more, so the caller shows the brand card instead.
 */
export function drawableTitle(font: FontMetrics, raw: string): string | null {
  const text = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  let kept = "";
  for (const ch of text) {
    if (ch === " " || font.advance(ch.codePointAt(0)!) !== undefined) {
      kept += ch;
    } else if (/[\p{L}\p{N}]/u.test(ch)) {
      return null;
    }
  }
  const cleaned = kept.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

export interface FitOptions {
  /** Width the lines must stay within, in pixels. */
  maxWidth: number;
  /** Height the block of lines must stay within, in pixels. */
  maxHeight: number;
  /** Candidate font sizes, largest first. */
  sizes: readonly number[];
  /** Line height as a multiple of the font size. */
  lineHeight: number;
}

export interface FittedTitle {
  fontSize: number;
  lines: string[];
}

/**
 * The largest size at which the title fits the box, broken into balanced
 * lines.
 *
 * Each candidate size is tried with greedy wrapping; the first one whose lines
 * all fit (no word wider than the box, no more lines than the height allows)
 * wins. Then the line width is narrowed to the least that still gives the same
 * number of lines, so a three-line title reads as three even lines rather than
 * two full ones and an orphan.
 *
 * Past the smallest size, words are broken and the last line ends in an
 * ellipsis. That is for titles nobody would write (the dashboard allows 200
 * characters), but it means no input can push text off the card.
 */
export function fitTitle(font: FontMetrics, title: string, opts: FitOptions): FittedTitle {
  const words = title.split(" ").filter(Boolean);
  for (const fontSize of opts.sizes) {
    const maxLines = Math.floor(opts.maxHeight / (fontSize * opts.lineHeight));
    const width = (s: string) => measure(font, s, fontSize);
    if (maxLines < 1 || words.some((w) => width(w) > opts.maxWidth)) continue;
    const lines = wrap(words, width, opts.maxWidth);
    if (lines.length <= maxLines) {
      return { fontSize, lines: balance(words, width, opts.maxWidth, lines.length) };
    }
  }

  const fontSize = opts.sizes[opts.sizes.length - 1];
  const maxLines = Math.max(1, Math.floor(opts.maxHeight / (fontSize * opts.lineHeight)));
  const width = (s: string) => measure(font, s, fontSize);
  const pieces = words.flatMap((w) => breakWord(w, width, opts.maxWidth));
  const lines = wrap(pieces, width, opts.maxWidth);
  if (lines.length <= maxLines) return { fontSize, lines };

  const kept = lines.slice(0, maxLines);
  // By code point, so trimming never splits a surrogate pair.
  const last = Array.from(kept[maxLines - 1]);
  while (last.length && width(`${last.join("")}…`) > opts.maxWidth) last.pop();
  kept[maxLines - 1] = `${last.join("").replace(/[\s,;:.–—-]+$/, "")}…`;
  return { fontSize, lines: kept };
}

/** Greedy line breaking at spaces. */
function wrap(words: string[], width: (s: string) => number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The narrowest wrap width that keeps the same line count, found by bisection. */
function balance(
  words: string[],
  width: (s: string) => number,
  maxWidth: number,
  count: number
): string[] {
  if (count < 2) return wrap(words, width, maxWidth);
  let lo = maxWidth / count;
  let hi = maxWidth;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (wrap(words, width, mid).length <= count) hi = mid;
    else lo = mid;
  }
  return wrap(words, width, hi);
}

/** Splits a word wider than the line into pieces that each fit. */
function breakWord(word: string, width: (s: string) => number, maxWidth: number): string[] {
  if (width(word) <= maxWidth) return [word];
  const pieces: string[] = [];
  let piece = "";
  for (const ch of word) {
    if (piece && width(piece + ch) > maxWidth) {
      pieces.push(piece);
      piece = ch;
    } else {
      piece += ch;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}
