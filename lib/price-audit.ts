import { priceRangeOf } from "@/lib/rates";
import { rateValues } from "@/lib/tokens";

/**
 * Finding copy that quotes a price the site no longer charges.
 *
 * `mergeContent` takes stored arrays wholesale, so once the dashboard has been
 * used the FAQ answer, the services card and the sliding scale are whatever was
 * saved — and a rate corrected in one of them stays wrong in the others with
 * nothing to say so. That is not hypothetical: the scale read ₹500 for students
 * while the FAQ two sections below it said ₹600, on the live site, for days.
 *
 * Tokens are the fix going forward — copy says {{rate.range}} and cannot drift.
 * This is for copy that was saved before, and for the next time someone types a
 * figure by hand: it compares every price in the text against the rates that are
 * actually on the scale, and names the ones that disagree.
 *
 * Only genuine disagreements are reported. A warning that fires on correct copy
 * is a warning people learn to scroll past.
 */

/** "₹500–₹1000", with either dash and any spacing around it. */
const RANGE = /₹\s*(\d{1,7})\s*[–—-]\s*₹\s*(\d{1,7})/g;
const AMOUNT = /₹\s*(\d{1,7})/g;

export interface PriceFinding {
  /** Dotted path into content, e.g. "faq.items[1].answer". */
  path: string;
  /** The whole string, so the finding can be recognised without hunting. */
  text: string;
  /** What disagrees, in terms someone can act on. */
  problem: string;
}

/**
 * The paths that declare a rate rather than quote one.
 *
 * The scale is the source of truth, so it cannot disagree with itself; and a
 * service's own price is a declaration too — mentoring is not on the sliding
 * scale and flagging it would be noise.
 */
function declaresRate(path: string): boolean {
  return /^slidingScale\[\d+\]$/.test(path) || /^services\.items\[\d+\]\.price$/.test(path);
}

/** Every string in a structure, with the path it was found at. */
export function walkStrings(
  value: unknown,
  visit: (path: string, text: string) => void,
  path = ""
): void {
  if (typeof value === "string") {
    visit(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkStrings(item, visit, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      walkStrings(item, visit, path ? `${path}.${key}` : key);
    }
  }
}

/** The amounts a piece of copy is allowed to name. */
function declaredAmounts(content: unknown): Set<number> {
  const allowed = new Set<number>();
  walkStrings(content, (path, text) => {
    if (!declaresRate(path)) return;
    for (const [, digits] of text.matchAll(AMOUNT)) allowed.add(Number(digits));
  });
  return allowed;
}

/**
 * Copy that quotes a price the rates no longer support.
 *
 * `scale` is the sliding scale as stored — unresolved, so a token counts as
 * agreeing with whatever it will resolve to, which is the whole point of it.
 */
export function auditPrices(
  content: unknown,
  scale: readonly string[]
): PriceFinding[] {
  /*
    A scale describes more than one range: the whole of it, and the band left
    once the concessional rate is set aside. Copy that explains both — "the scale
    runs ₹500–₹1000, and if you are earning you choose within ₹800–₹1000" — is
    correct, so the ranges a rate token can produce are the ranges copy may name.
  */
  const values = rateValues(scale);
  // No rates means no reference to judge against, and a figure in a sentence is
  // then just a figure. Saying nothing is the honest answer.
  if (Object.keys(values).length === 0) return [];

  const ranges = new Set(
    Object.values(values).filter((value) => value.includes("–"))
  );
  const range = priceRangeOf(scale);
  const allowed = declaredAmounts(content);
  const findings: PriceFinding[] = [];

  walkStrings(content, (path, text) => {
    if (declaresRate(path)) {
      /*
        A declared price is a rate, and a rate is one figure — so a range here is
        not a price of its own, it is the scale written out a second time. That is
        how the services card came to say ₹500–₹1000 while the scale said
        something else. Only an exact restatement is reported: a service really
        priced as its own range is its own thing and none of this applies.
      */
      const quoted = [...text.matchAll(RANGE)].map((m) => `₹${m[1]}–₹${m[2]}`);
      for (const value of quoted) {
        if (!ranges.has(value)) continue;
        const token = value === values["rate.range"] ? "{{rate.range}}" : "{{rate.band}}";
        findings.push({
          path,
          text,
          problem: `repeats the scale — ${token} would follow the rates list instead`,
        });
      }
      return;
    }

    const quotedRanges = [...text.matchAll(RANGE)];
    for (const match of quotedRanges) {
      const quoted = `₹${match[1]}–₹${match[2]}`;
      if (ranges.size > 0 && !ranges.has(quoted)) {
        findings.push({
          path,
          text,
          problem: `quotes ${quoted}, which is neither the scale (${range}) nor the band it leaves`,
        });
      }
    }

    // Amounts inside a range have been judged already; a lone figure is the
    // other way copy goes stale — "the ₹600 rate is for students".
    const inRanges = new Set(
      quotedRanges.flatMap((m) => [Number(m[1]), Number(m[2])])
    );
    for (const [, digits] of text.matchAll(AMOUNT)) {
      const amount = Number(digits);
      if (inRanges.has(amount) || allowed.has(amount)) continue;
      findings.push({
        path,
        text,
        problem: `names ₹${amount}, which is not a rate on the scale`,
      });
    }
  });

  return findings;
}

export interface GroupedFinding {
  path: string;
  text: string;
  problems: string[];
}

/**
 * Findings collected per field, for display.
 *
 * One sentence can be wrong in two ways at once — a stale range and a stale
 * figure — and that is still one sentence to fix, not two warnings to read.
 */
export function groupFindings(findings: readonly PriceFinding[]): GroupedFinding[] {
  const byPath = new Map<string, GroupedFinding>();
  for (const finding of findings) {
    const entry =
      byPath.get(finding.path) ??
      { path: finding.path, text: finding.text, problems: [] };
    if (!entry.problems.includes(finding.problem)) entry.problems.push(finding.problem);
    byPath.set(finding.path, entry);
  }
  return [...byPath.values()];
}
