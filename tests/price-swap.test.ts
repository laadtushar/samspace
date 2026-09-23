import { describe, it, expect } from "vitest";
import { swapsFor, applySwaps } from "@/lib/price-swap";
import { pricingFor } from "@/lib/pricing";
import { DEFAULT_SLIDING_SCALE } from "@/lib/rates";
import { defaultRule, type CountryRule } from "@/lib/country-pricing";
import type { FxRate } from "@/lib/convert";

/**
 * Swapping the rupee figures a page has already rendered.
 *
 * The bug these exist for: only the services card converted, so a visitor
 * abroad read a converted scale in one section and rupees in the FAQ two
 * sections below. Everything here is about the figures agreeing.
 */

const SCALE = [...DEFAULT_SLIDING_SCALE];
const AED: FxRate = {
  currency: "AED",
  perRupee: 0.0415,
  asOf: new Date().toISOString(),
};
const on = (country = "AE"): { rule: CountryRule } => ({
  rule: { ...defaultRule(country), enabled: true },
});

const converted = () => pricingFor(SCALE, "AE", AED, on());
const native = () => pricingFor(SCALE, "AE", AED);

describe("when nothing is converted", () => {
  it("offers no swaps, so the page is left exactly as rendered", () => {
    expect(swapsFor(native())).toEqual([]);
    expect(swapsFor(null)).toEqual([]);
  });

  it("leaves text untouched when there are no swaps", () => {
    const text = "Sessions run on a sliding scale of ₹500–₹1000.";
    expect(applySwaps(text, [])).toBe(text);
  });
});

describe("the whole scale is available, not only what is on offer", () => {
  it("converts the concessional rate even where it cannot be chosen", () => {
    /*
      The FAQ tells everyone about the student rate, including visitors abroad
      who are not offered it. Leaving that one figure in rupees beside a
      converted scale is the inconsistency this exists to prevent.
    */
    const view = converted();
    expect(view.tiers.map((t) => t.rupees)).toEqual([800, 900, 1000]);
    expect(view.all.map((t) => t.rupees)).toEqual([500, 800, 900, 1000]);
  });

  it("converts the whole scale as one set, so two rates never collide", () => {
    const view = converted();
    const shown = view.all.map((t) => t.display);
    expect(new Set(shown).size).toBe(shown.length);
  });

  it("carries nothing to swap when the figures are rupees", () => {
    expect(native().all).toEqual([]);
  });
});

describe("what gets replaced", () => {
  it("swaps a single rate", () => {
    const swaps = swapsFor(converted());
    expect(applySwaps("The ₹500 rate is for students.", swaps)).not.toContain("₹500");
  });

  it("swaps a range before its own endpoints", () => {
    /*
      Order is the whole trick. "₹800–₹1000" contains "₹800", so replacing the
      shorter one first leaves a mangled range with one end converted and one
      not — which is worse than not converting at all.
    */
    const out = applySwaps("anywhere in ₹800–₹1000", swapsFor(converted()));
    expect(out).not.toContain("₹");
    expect(out).toMatch(/AED\s?\d+.*AED\s?\d+/);
  });

  it("handles a sentence quoting the full scale and the band together", () => {
    const text =
      "Sessions run on a sliding scale of ₹500–₹1000. If you're earning, you choose anywhere in ₹800–₹1000. The ₹500 rate is reserved for students.";
    const out = applySwaps(text, swapsFor(converted()));
    expect(out).not.toContain("₹");
    expect(out).toContain("AED");
  });

  it("replaces every occurrence, because a sentence can say a rate twice", () => {
    const out = applySwaps("₹800 today, ₹800 next week", swapsFor(converted()));
    expect(out).not.toContain("₹800");
  });

  it("leaves a rupee figure that is not on the scale alone", () => {
    // Somebody's sentence, not a price. A pattern that rewrote every ₹ it
    // found would eventually rewrite one that was never a rate.
    const out = applySwaps("A year of weekly sessions is about ₹45000.", swapsFor(converted()));
    expect(out).toContain("₹45000");
  });

  it("never produces a swap that changes nothing", () => {
    for (const swap of swapsFor(converted())) {
      expect(swap.from).not.toBe(swap.to);
    }
  });
});

describe("the surfaces that used to disagree", () => {
  const faqAnswer =
    "Sessions run on a sliding scale of ₹500–₹1000. If you're earning, you choose anywhere in ₹800–₹1000 — whichever rate matches your financial situation. The ₹500 rate is reserved for students without an independent income.";
  const assurance = "💫 Sliding scale ₹500–₹1000";

  it("converts the FAQ answer and the services range to the same figures", () => {
    const view = converted();
    const swapped = applySwaps(faqAnswer, swapsFor(view));
    // The band quoted in the FAQ is the range the services card shows.
    expect(swapped).toContain(view.range);
  });

  it("converts the intake form's assurance line", () => {
    const out = applySwaps(assurance, swapsFor(converted()));
    expect(out).not.toContain("₹");
  });

  it("leaves both alone when the visitor is at home", () => {
    const swaps = swapsFor(pricingFor(SCALE, "IN", null, on("IN")));
    expect(applySwaps(faqAnswer, swaps)).toBe(faqAnswer);
    expect(applySwaps(assurance, swaps)).toBe(assurance);
  });

  it("leaves both alone when the country was never enabled", () => {
    // A rate existing is not a decision to quote in it, on any surface.
    const swaps = swapsFor(pricingFor(SCALE, "AE", AED));
    expect(applySwaps(faqAnswer, swaps)).toBe(faqAnswer);
  });
});
