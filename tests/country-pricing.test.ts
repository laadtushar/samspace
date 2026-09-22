import { describe, it, expect } from "vitest";
import {
  markUp,
  applyMarkup,
  basisFor,
  markupSourceFor,
  effectiveMarkup,
  normaliseCountry,
  markupProblem,
  overrideProblem,
  defaultRule,
  MAX_MARKUP_PERCENT,
  MARKUP_STEP,
  type CountryRule,
} from "@/lib/country-pricing";
import { pricingFor } from "@/lib/pricing";
import { DEFAULT_SLIDING_SCALE } from "@/lib/rates";
import { PRACTICE_CURRENCY } from "@/lib/money";
import type { FxRate } from "@/lib/convert";

/**
 * What a country is charged, and whether it is quoted in its own money.
 *
 * The two are separate decisions and most of what follows exists to keep them
 * that way: a rate existing must not enable a country, and enabling a country
 * must not change what anyone else pays.
 */

const SCALE = [...DEFAULT_SLIDING_SCALE];
const rule = (extra: Partial<CountryRule> = {}): CountryRule => ({
  ...defaultRule("AE"),
  ...extra,
});
const fresh = (currency: string, perRupee: number): FxRate => ({
  currency,
  perRupee,
  asOf: new Date().toISOString(),
});

describe("marking an amount up", () => {
  it("leaves the amount alone at nothing per cent", () => {
    for (const amount of [500, 800, 900, 1000]) {
      expect(markUp(amount, 0)).toBe(amount);
    }
  });

  it("rounds up to something a person would have chosen", () => {
    // ₹800 plus 37% is ₹1096, which reads like a spreadsheet, because it is.
    expect(markUp(800, 37)).toBe(1100);
    expect(markUp(800, 50)).toBe(1200);
    expect(markUp(900, 50)).toBe(1350);
  });

  it("rounds up rather than down, so the figure is never under the intent", () => {
    const marked = markUp(801, 10);
    expect(marked).toBeGreaterThanOrEqual(801 * 1.1);
    expect(marked % MARKUP_STEP).toBe(0);
  });

  it("treats a nonsensical percentage as no markup rather than as zero rupees", () => {
    // NaN would otherwise propagate into every tier and quote a free session.
    for (const bad of [Number.NaN, -10, Number.POSITIVE_INFINITY]) {
      expect(markUp(800, bad as number)).toBe(800);
    }
  });
});

describe("marking a scale up", () => {
  it("keeps each entry's wording, including the concessional label", () => {
    const marked = applyMarkup(["₹500 (Student)", "₹800"], 50);
    expect(marked[0]).toBe("₹750 (Student)");
    expect(marked[1]).toBe("₹1200");
  });

  it("passes through an entry with no amount rather than dropping it", () => {
    // It is someone's note. Losing it silently is worse than carrying it.
    const marked = applyMarkup(["₹800", "ask me"], 50);
    expect(marked).toEqual(["₹1200", "ask me"]);
  });
});

describe("which rupee figures a country is priced from", () => {
  it("is the base scale when nothing has been decided", () => {
    expect(basisFor(SCALE, null)).toEqual(SCALE);
    expect(basisFor(SCALE, undefined)).toEqual(SCALE);
  });

  it("is the base scale untouched when the country is not enabled", () => {
    /*
      A markup exists to be converted alongside. Applying it while still
      quoting rupees would quietly charge that country more in the practice's
      own currency, which is not what enabling a country is for.
    */
    const basis = basisFor(SCALE, rule({ enabled: false, markupPercent: 100 }));
    expect(basis).toEqual(SCALE);
  });

  it("is the marked-up scale when a markup is set", () => {
    const basis = basisFor(SCALE, rule({ enabled: true, markupPercent: 50 }));
    expect(basis).toEqual(["₹750 (Student)", "₹1200", "₹1350", "₹1500"]);
  });

  it("is the override where one is set, markup or no markup", () => {
    // Absolute is the more specific statement: someone who typed exact
    // amounts for a country meant them.
    const basis = basisFor(
      SCALE,
      rule({ enabled: true, markupPercent: 50, overrideScale: ["₹1111", "₹2222"] })
    );
    expect(basis).toEqual(["₹1111", "₹2222"]);
  });

  it("ignores an empty override rather than pricing a country at nothing", () => {
    const basis = basisFor(SCALE, rule({ enabled: true, overrideScale: [] }));
    expect(basis).toEqual(SCALE);
  });

  it("does not follow the base scale once an override is set", () => {
    const over = rule({ enabled: true, overrideScale: ["₹1111"] });
    expect(basisFor(["₹5000"], over)).toEqual(["₹1111"]);
  });
});

describe("what a visitor actually sees", () => {
  const AED = fresh("AED", 0.0415);

  it("is rupees in a country nobody enabled, however good the rate", () => {
    // The regression this whole feature exists to prevent: adding a rate must
    // not change what anyone is shown.
    const view = pricingFor(SCALE, "AE", AED);
    expect(view.native).toBe(true);
    expect(view.currency).toBe(PRACTICE_CURRENCY);
  });

  it("is the local currency once the country is enabled", () => {
    const view = pricingFor(SCALE, "AE", AED, {
      rule: rule({ enabled: true }),
    });
    expect(view.native).toBe(false);
    expect(view.currency).toBe("AED");
  });

  it("converts the marked-up figures, not the base ones", () => {
    const base = pricingFor(SCALE, "AE", AED, { rule: rule({ enabled: true }) });
    const marked = pricingFor(SCALE, "AE", AED, {
      rule: rule({ enabled: true, markupPercent: 50 }),
    });

    expect(marked.tiers[0].rupees).toBe(1200);
    expect(base.tiers[0].rupees).toBe(800);
    expect(marked.tiers[0].display).not.toBe(base.tiers[0].display);
  });

  it("keeps the marked-up rupees as the amount actually charged", () => {
    /*
      The converted figure is guidance; the invoice is rupees. When a country
      is marked up, the rupee figure that travels alongside has to be the
      marked-up one, or an invoice would be raised for less than was quoted.
    */
    const view = pricingFor(SCALE, "AE", AED, {
      rule: rule({ enabled: true, markupPercent: 50 }),
    });
    expect(view.tiers.map((t) => t.rupees)).toEqual([1200, 1350, 1500]);
  });

  it("still refuses to convert without a rate worth quoting", () => {
    // Enabling a country is permission, not a promise. Everything that made
    // conversion unsafe before still does.
    const view = pricingFor(SCALE, "AE", null, { rule: rule({ enabled: true }) });
    expect(view.native).toBe(true);
  });

  it("still refuses a stale rate for an enabled country", () => {
    const stale = {
      ...fresh("AED", 0.0415),
      asOf: new Date(Date.now() - 400 * 86_400_000).toISOString(),
      source: "feed" as const,
    };
    const view = pricingFor(SCALE, "AE", stale, { rule: rule({ enabled: true }) });
    expect(view.native).toBe(true);
  });

  it("leaves home alone, enabled or not", () => {
    // Converting rupees to rupees is not a conversion, and the concessional
    // tier is a policy about India that no country setting may move.
    const view = pricingFor(SCALE, "IN", fresh("INR", 1), {
      rule: rule({ country: "IN", enabled: true, markupPercent: 50 }),
    });
    expect(view.native).toBe(true);
    expect(view.tiers.some((t) => t.student)).toBe(true);
  });

  it("does not offer the concessional tier abroad, override or not", () => {
    const view = pricingFor(SCALE, "AE", AED, {
      rule: rule({ enabled: true, overrideScale: ["₹600 (Student)", "₹1200"] }),
    });
    expect(view.tiers.some((t) => t.student)).toBe(false);
  });
});

describe("refusing a setting before it reaches anyone", () => {
  it("takes a country code and nothing else", () => {
    expect(normaliseCountry("ae")).toBe("AE");
    expect(normaliseCountry(" gb ")).toBe("GB");
    for (const bad of ["", "ARE", "1A", null, 42, undefined]) {
      expect(normaliseCountry(bad)).toBeNull();
    }
  });

  it("refuses a negative markup", () => {
    // A discount for being abroad is not a thing this practice offers, and is
    // far more likely to be a missing keystroke.
    expect(markupProblem(-50)).not.toBe("");
    expect(markupProblem(0)).toBe("");
    expect(markupProblem(50)).toBe("");
  });

  it("refuses a markup beyond anything real", () => {
    expect(markupProblem(MAX_MARKUP_PERCENT)).toBe("");
    expect(markupProblem(MAX_MARKUP_PERCENT + 1)).not.toBe("");
  });

  it("refuses a markup that is not a number", () => {
    for (const bad of ["fifty", Number.NaN, {}]) {
      expect(markupProblem(bad)).not.toBe("");
    }
  });

  it("accepts no markup at all, which means take the common one", () => {
    // An empty box is how someone says "whatever everywhere else is". It is
    // not a mistake and must not be reported as one.
    for (const nothing of [null, undefined, ""]) {
      expect(markupProblem(nothing)).toBe("");
    }
  });

  it("accepts no override, and refuses one with nothing priceable in it", () => {
    expect(overrideProblem(null)).toBe("");
    expect(overrideProblem([])).toBe("");
    expect(overrideProblem(["₹1200"])).toBe("");
    expect(overrideProblem(["no amount here"])).not.toBe("");
    expect(overrideProblem("₹1200")).not.toBe("");
    expect(overrideProblem([1200])).not.toBe("");
  });
});

describe("a markup for every country at once", () => {
  const AED = fresh("AED", 0.0415);

  it("applies where a country has not set one of its own", () => {
    // Setting the same percentage on forty countries by hand is forty chances
    // to mistype one, and no way to change them together afterwards.
    const basis = basisFor(SCALE, rule({ enabled: true, markupPercent: null }), 50);
    expect(basis).toEqual(["₹750 (Student)", "₹1200", "₹1350", "₹1500"]);
  });

  it("yields to a country that has set its own", () => {
    const basis = basisFor(SCALE, rule({ enabled: true, markupPercent: 100 }), 50);
    expect(basis).toEqual(["₹1000 (Student)", "₹1600", "₹1800", "₹2000"]);
  });

  it("treats a country's nought as a real answer, not as nothing set", () => {
    /*
      The distinction the whole nullable column exists for. Somewhere the
      practice deliberately wants to charge at par — a neighbour, a country
      where the common markup would be indefensible — and 0 is how that is
      said. Reading it as "nothing set" would mark that country up with
      everywhere else and there would be no way to stop it.
    */
    const basis = basisFor(SCALE, rule({ enabled: true, markupPercent: 0 }), 50);
    expect(basis).toEqual(SCALE);
  });

  it("does nothing to a country that is not enabled", () => {
    const basis = basisFor(SCALE, rule({ enabled: false, markupPercent: null }), 50);
    expect(basis).toEqual(SCALE);
  });

  it("loses to an override, which is the most specific thing anyone typed", () => {
    const basis = basisFor(
      SCALE,
      rule({ enabled: true, markupPercent: null, overrideScale: ["₹1111"] }),
      50
    );
    expect(basis).toEqual(["₹1111"]);
  });

  it("says which markup is in force, so a screen can explain itself", () => {
    // 60% against a common 50% is either a deliberate exception or a typo, and
    // only the person who set it can tell from a screen that says which.
    expect(markupSourceFor(rule({ markupPercent: 60 }), 50)).toEqual({
      percent: 60,
      source: "country",
    });
    expect(markupSourceFor(rule({ markupPercent: null }), 50)).toEqual({
      percent: 50,
      source: "common",
    });
    expect(markupSourceFor(rule({ markupPercent: null }), 0)).toEqual({
      percent: 0,
      source: "none",
    });
    expect(markupSourceFor(rule({ markupPercent: 0 }), 50)).toEqual({
      percent: 0,
      source: "country",
    });
  });

  it("reaches the converted figures a visitor is served", () => {
    const view = pricingFor(SCALE, "AE", AED, {
      rule: rule({ enabled: true, markupPercent: null }),
      defaultMarkupPercent: 50,
    });
    expect(view.native).toBe(false);
    // The rupees travelling alongside are the marked-up ones, so an invoice is
    // never raised for less than was quoted.
    expect(view.tiers.map((t) => t.rupees)).toEqual([1200, 1350, 1500]);
  });

  it("changes every inheriting country at once when it moves", () => {
    const inheriting = rule({ enabled: true, markupPercent: null });
    expect(effectiveMarkup(inheriting, 25)).toBe(25);
    expect(effectiveMarkup(inheriting, 75)).toBe(75);
    // And leaves the one that opted out exactly where it was.
    const own = rule({ enabled: true, markupPercent: 10 });
    expect(effectiveMarkup(own, 25)).toBe(10);
    expect(effectiveMarkup(own, 75)).toBe(10);
  });
});
