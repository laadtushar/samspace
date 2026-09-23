import { formatMoney, formatMoneyRange, PRACTICE_CURRENCY } from "@/lib/money";
import type { PricingView } from "@/lib/pricing";

/**
 * Turning the rupee figures already on a page into converted ones.
 *
 * Only one part of the site used to convert: the services card, through the
 * Price component. Every other place a price appears — the FAQ answer, the
 * intake form's assurances and its slider — is prose with the figure filled in
 * server-side, in rupees, into cached HTML. A visitor in the UAE therefore read
 * a converted scale in one section and rupees two sections below it, which is
 * exactly the disagreement the price audit exists to catch, in a dimension it
 * cannot see.
 *
 * The page cannot render those converted on the server, because every public
 * page is one cached copy shared by every country. So the figures are replaced
 * in the rendered text, for that visitor alone, after hydration.
 *
 * Replacement is by exact string, never by pattern. A rupee amount that is not
 * on the scale is left alone: it is somebody's sentence, and a regex that
 * rewrote every ₹ it found would eventually rewrite one that was not a price.
 */

export interface Swap {
  from: string;
  to: string;
}

/**
 * What to replace, longest first.
 *
 * Order is load-bearing. "₹800–₹1000" contains "₹800", so replacing the
 * shorter one first would leave a mangled range with one end converted.
 */
export function swapsFor(view: PricingView | null): Swap[] {
  if (!view || view.native || view.all.length === 0) return [];

  const swaps: Swap[] = [];
  const rupees = view.all.map((tier) => tier.rupees);
  const shown = view.all.map((tier) => tier.display);

  /*
    Ranges the copy might quote. The full scale and the band above the
    concessional rate are the two the tokens produce, but a range is built
    from whatever two figures the writer picked, so every pair that appears in
    ascending order is offered. The list is tiny — a scale has a handful of
    rates — and a swap nobody needs simply never matches.
  */
  for (let i = 0; i < rupees.length; i += 1) {
    for (let j = i + 1; j < rupees.length; j += 1) {
      const low = Math.min(rupees[i], rupees[j]);
      const high = Math.max(rupees[i], rupees[j]);
      if (low === high) continue;

      const from = formatMoneyRange(low, high);
      const to = formatMoneyRange(
        Math.min(convertedFor(view, low) ?? 0, convertedFor(view, high) ?? 0),
        Math.max(convertedFor(view, low) ?? 0, convertedFor(view, high) ?? 0),
        view.currency
      );
      if (converted(view, low) && converted(view, high)) swaps.push({ from, to });
    }
  }

  for (let i = 0; i < rupees.length; i += 1) {
    swaps.push({ from: formatMoney(rupees[i]), to: shown[i] });
  }

  // Longest first, so a range is never broken by its own endpoints.
  return dedupe(swaps).sort((a, b) => b.from.length - a.from.length);
}

function converted(view: PricingView, rupees: number): boolean {
  return view.all.some((tier) => tier.rupees === rupees);
}

/** The converted amount for a rupee figure, as a number, or null. */
function convertedFor(view: PricingView, rupees: number): number | null {
  const tier = view.all.find((entry) => entry.rupees === rupees);
  if (!tier) return null;
  const digits = tier.display.replace(/[^\d.]/g, "");
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

function dedupe(swaps: Swap[]): Swap[] {
  const seen = new Set<string>();
  return swaps.filter((swap) => {
    if (swap.from === swap.to || seen.has(swap.from)) return false;
    seen.add(swap.from);
    return true;
  });
}

/**
 * Applies the swaps to a piece of text.
 *
 * Plain string replacement rather than a regular expression, because the
 * figures come from stored content and a rupee amount is not a safe pattern to
 * build one from. Every occurrence is replaced: a sentence can mention the
 * same rate twice.
 */
export function applySwaps(text: string, swaps: readonly Swap[]): string {
  if (!text || swaps.length === 0) return text;

  let out = text;
  for (const swap of swaps) {
    if (!out.includes(swap.from)) continue;
    out = out.split(swap.from).join(swap.to);
  }
  return out;
}

/** True when a piece of text mentions a figure that would be swapped. */
export function mentionsPrice(text: string): boolean {
  return typeof text === "string" && text.includes(PRACTICE_CURRENCY === "INR" ? "₹" : "");
}
