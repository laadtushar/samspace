import { describe, it, expect } from "vitest";
import {
  convert,
  convertScale,
  rateIsFresh,
  roundingStepFor,
  roundingLadder,
  minorUnitsFor,
  MAX_RATE_AGE_DAYS,
  type FxRate,
} from "@/lib/convert";
import { formatMoney } from "@/lib/money";

/**
 * Converting a rupee price into a figure someone elsewhere can read.
 *
 * Every price here is charged and settled in rupees; this produces guidance.
 * The tests are mostly about the two ways guidance goes wrong — a figure that
 * reads as less than the invoice will say, and a figure nobody could act on.
 */
const rate = (currency: string, perRupee: number, asOf = new Date().toISOString()): FxRate => ({
  currency,
  perRupee,
  asOf,
});

// Rough real-world orders of magnitude, so the rounding is judged on numbers it
// will actually meet rather than on tidy fictions.
const USD = rate("USD", 0.0113);
const AED = rate("AED", 0.0415);
const JPY = rate("JPY", 1.78);
const VND = rate("VND", 297);

describe("what a rupee price becomes", () => {
  it("converts the scale into figures that read like prices", () => {
    expect(formatMoney(convert(500, USD)!, "USD")).toBe("$6");
    expect(formatMoney(convert(1000, USD)!, "USD")).toBe("$12");
    expect(formatMoney(convert(800, AED)!, "AED")).toContain("35");
  });

  it("rounds up, never down", () => {
    /*
      The invoice is in rupees and this figure is an estimate of it. Quoting
      less sets up an invoice that reads as more than was advertised, which is
      the one direction that feels like a bait.
    */
    for (const rupees of [500, 800, 900, 1000, 1234]) {
      const converted = convert(rupees, USD)!;
      expect(converted, `${rupees}`).toBeGreaterThanOrEqual(rupees * USD.perRupee);
    }
  });

  it("never prints a fraction a currency does not have", () => {
    // Yen and dong have no minor unit; a price with decimals cannot exist.
    expect(Number.isInteger(convert(500, JPY)!)).toBe(true);
    expect(Number.isInteger(convert(500, VND)!)).toBe(true);
    expect(formatMoney(convert(500, JPY)!, "JPY")).not.toContain(".");
  });

  it("leaves no floating-point tail on the figure", () => {
    for (const r of [USD, AED, JPY, VND]) {
      const converted = String(convert(777, r));
      expect(converted, r.currency).not.toMatch(/\.\d{4,}/);
    }
  });

  it("keeps a six-figure conversion readable", () => {
    // ₹1000 is about ₫297,000 — the case that makes grouping separators matter.
    const dong = convert(1000, VND)!;
    expect(dong).toBeGreaterThan(100_000);
    expect(formatMoney(dong, "VND")).toContain(",");
  });
});

describe("conversions not worth putting in front of anyone", () => {
  it("declines rather than converting to the currency it is already in", () => {
    expect(convert(500, rate("INR", 1))).toBeNull();
  });

  it("declines a rate that is not a number to multiply by", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(convert(500, rate("USD", bad)), String(bad)).toBeNull();
    }
  });

  it("declines a currency code that is not one", () => {
    for (const bad of ["usd", "US", "DOLLAR", "₹", ""]) {
      expect(convert(500, rate(bad, 0.012)), bad).toBeNull();
    }
  });

  it("declines an amount that is not a price", () => {
    for (const bad of [0, -500, Number.NaN]) {
      expect(convert(bad, USD), String(bad)).toBeNull();
    }
  });
});

describe("how old a rate may be", () => {
  const daysAgo = (n: number) =>
    new Date(Date.now() - n * 86_400_000).toISOString();

  it("quotes a rate fetched recently", () => {
    expect(rateIsFresh(rate("USD", 0.012, daysAgo(0)))).toBe(true);
    expect(rateIsFresh(rate("USD", 0.012, daysAgo(MAX_RATE_AGE_DAYS - 1)))).toBe(true);
  });

  it("stops quoting one that has gone stale", () => {
    // By a fortnight the number on the page is a claim about a world that has
    // moved; falling back to rupees is the honest answer.
    expect(rateIsFresh(rate("USD", 0.012, daysAgo(MAX_RATE_AGE_DAYS + 1)))).toBe(false);
  });

  it("rejects a rate from the future and an unparseable date", () => {
    expect(rateIsFresh(rate("USD", 0.012, daysAgo(-2)))).toBe(false);
    expect(rateIsFresh(rate("USD", 0.012, "not a date"))).toBe(false);
  });
});

describe("how far a figure is rounded", () => {
  it("scales the step with the size of the number", () => {
    // Coarsest rung of the ladder that is still at most a quarter of the
    // figure, so the step tidies the number rather than replacing it.
    for (const [amount, currency] of [
      [6, "USD"],
      [35, "AED"],
      [890, "JPY"],
      [148_500, "VND"],
    ] as const) {
      const step = roundingStepFor(amount, currency);
      expect(step, `${currency} ${amount}`).toBeLessThanOrEqual(amount / 4);
      expect(step, `${currency} ${amount}`).toBeGreaterThan(0);
    }
    // Bigger figures get bigger steps.
    expect(roundingStepFor(148_500, "VND")).toBeGreaterThan(
      roundingStepFor(890, "VND")
    );
  });

  it("rounds a lone figure more coarsely than a scale would", () => {
    /*
      A single price has no neighbours to stay distinct from, so it takes the
      coarsest step it can: $5.65 becomes $6, and $6.40 becomes $7. Inside a
      scale the same rate produces $6 for the same tier, because the step is
      chosen for the set. That difference is the reason convertScale exists and
      is what callers showing a scale should use.
    */
    const rate = { currency: "USD", perRupee: 0.0113, asOf: new Date().toISOString() };
    expect(convert(500, rate)).toBe(6);
    expect(convertScale([500, 800, 900, 1000], rate)![0]).toBe(6);
  });

  it("never proposes a fractional step for a currency without fractions", () => {
    for (const amount of [5, 50, 5000]) {
      expect(Number.isInteger(roundingStepFor(amount, "JPY")), String(amount)).toBe(true);
    }
  });

  it("reads each currency's real precision", () => {
    expect(minorUnitsFor("JPY")).toBe(0);
    expect(minorUnitsFor("USD")).toBe(2);
    expect(minorUnitsFor("KWD")).toBe(3);
    // An unknown code should not throw; two is the safe guess.
    expect(minorUnitsFor("NOTACODE")).toBe(2);
  });
});

/**
 * The property that matters most, and the one rounding each figure alone
 * cannot hold: a sliding scale has to stay a scale.
 *
 * At a realistic rate ₹900 and ₹1000 both round to KWD 3.500. Four tiers that
 * read alike is a choice with nothing to choose between — worse than showing no
 * conversion, because it looks deliberate.
 */
describe("a scale stays a scale", () => {
  const SCALE = [500, 800, 900, 1000];

  // Rough real-world magnitudes across the range of currency shapes: tiny
  // denominations, huge ones, and the three-decimal Gulf dinars where the
  // tiers sit closest together.
  const RATES: Record<string, number> = {
    USD: 0.0113,
    GBP: 0.0089,
    EUR: 0.0104,
    AED: 0.0415,
    SGD: 0.0152,
    JPY: 1.78,
    KRW: 15.8,
    VND: 297,
    IDR: 190,
    KWD: 0.00346,
    BHD: 0.00426,
    OMR: 0.00435,
  };

  it("keeps every tier distinct in every currency", () => {
    for (const [currency, perRupee] of Object.entries(RATES)) {
      const converted = convertScale(SCALE, {
        currency,
        perRupee,
        asOf: new Date().toISOString(),
      });
      expect(converted, currency).not.toBeNull();
      expect(new Set(converted!).size, `${currency}: ${converted}`).toBe(SCALE.length);
    }
  });

  it("keeps the tiers in the order they were given", () => {
    for (const [currency, perRupee] of Object.entries(RATES)) {
      const converted = convertScale(SCALE, {
        currency,
        perRupee,
        asOf: new Date().toISOString(),
      })!;
      const ascending = [...converted].sort((a, b) => a - b);
      expect(converted, currency).toEqual(ascending);
    }
  });

  it("is the case the old per-figure rounding got wrong", () => {
    // Kept as a named regression: ₹900 and ₹1000 in dinars.
    const rate = { currency: "KWD", perRupee: 0.00346, asOf: new Date().toISOString() };
    const [nine, ten] = convertScale([900, 1000], rate)!;
    expect(nine).not.toBe(ten);
  });

  it("rounds every tier up, never down", () => {
    const perRupee = 0.0113;
    const converted = convertScale(SCALE, {
      currency: "USD",
      perRupee,
      asOf: new Date().toISOString(),
    })!;
    SCALE.forEach((rupees, i) => {
      expect(converted[i], `${rupees}`).toBeGreaterThanOrEqual(rupees * perRupee);
    });
  });

  it("declines the whole scale rather than converting part of it", () => {
    expect(convertScale([], { currency: "USD", perRupee: 0.0113, asOf: new Date().toISOString() })).toBeNull();
    expect(
      convertScale([500, -800], { currency: "USD", perRupee: 0.0113, asOf: new Date().toISOString() })
    ).toBeNull();
  });

  it("never proposes a step finer than the currency can express", () => {
    for (const currency of ["JPY", "USD", "KWD"]) {
      const finest = Math.pow(10, -minorUnitsFor(currency));
      for (const step of roundingLadder(1000, currency)) {
        expect(step, `${currency} ${step}`).toBeGreaterThanOrEqual(finest);
      }
    }
  });

  it("never proposes a step that would swallow the figure", () => {
    for (const magnitude of [6, 45, 1800, 297_000]) {
      const step = roundingStepFor(magnitude, "USD");
      expect(step, String(magnitude)).toBeLessThanOrEqual(magnitude / 4);
    }
  });
});
