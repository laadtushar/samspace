import { describe, it, expect } from "vitest";
import {
  pricingFor,
  tiersFor,
  studentRateApplies,
  CONVERTED_NOTE,
  HOME_COUNTRY,
} from "@/lib/pricing";
import { DEFAULT_SLIDING_SCALE } from "@/lib/rates";
import { PRACTICE_CURRENCY } from "@/lib/money";
import type { FxRate } from "@/lib/convert";
import type { PricingOptions } from "@/lib/pricing";
import type { CountryRule } from "@/lib/country-pricing";

/**
 * What a particular visitor is shown.
 *
 * The two decisions here have different reasons and must not move together:
 * who may take the concessional rate is a policy, and which money the figures
 * are in depends on whether there is a rate worth quoting. Most of these tests
 * exist to hold them apart.
 */
const SCALE = [...DEFAULT_SLIDING_SCALE];
const fresh = (currency: string, perRupee: number): FxRate => ({
  currency,
  perRupee,
  asOf: new Date().toISOString(),
});
const USD = fresh("USD", 0.0113);
const AED = fresh("AED", 0.0415);

/**
 * A country the practice has turned on.
 *
 * Conversion is a decision now, not a consequence of a rate existing, so every
 * test that expects a converted figure has to say which country was enabled —
 * and every test that expects rupees despite a good rate has to enable one too,
 * or it passes for the wrong reason.
 */
const on = (country: string, extra: Partial<CountryRule> = {}): PricingOptions => ({
  rule: { country, enabled: true, markupPercent: 0, overrideScale: null, ...extra },
});

describe("who may take the student rate", () => {
  it("offers it at home", () => {
    expect(studentRateApplies(HOME_COUNTRY)).toBe(true);
    expect(pricingFor(SCALE, "IN", null).tiers.some((t) => t.student)).toBe(true);
  });

  it("does not offer it anywhere else", () => {
    // Funded by Indian clients choosing to pay more, so offered where that
    // holds. Elsewhere nothing should hint at a rate the visitor cannot take.
    for (const country of ["US", "GB", "AE", "SG", "ZZ"]) {
      const view = pricingFor(SCALE, country, null);
      expect(view.tiers.some((t) => t.student), country).toBe(false);
    }
  });

  it("does not change because a rate feed did or did not work", () => {
    /*
      The failure this separation exists to prevent: a visitor in London offered
      a student rate because the feed was down, or refused one in Delhi because
      it was up.
    */
    expect(pricingFor(SCALE, "GB", null).tiers.some((t) => t.student)).toBe(false);
    expect(
      pricingFor(SCALE, "GB", fresh("GBP", 0.0089)).tiers.some((t) => t.student)
    ).toBe(false);
    expect(pricingFor(SCALE, "IN", USD).tiers.some((t) => t.student)).toBe(true);
  });

  it("never leaves a visitor with nothing to choose", () => {
    // An all-concessional scale is a configuration mistake, not a reason to
    // show someone abroad no prices at all.
    const onlyStudent = ["₹500 (Student)"];
    expect(tiersFor(onlyStudent, "US")).toEqual(onlyStudent);
    expect(pricingFor(onlyStudent, "US", null).tiers).toHaveLength(1);
  });
});

describe("at home", () => {
  it("shows exactly the rupees the site has always shown", () => {
    const view = pricingFor(SCALE, "IN", null);
    expect(view.currency).toBe(PRACTICE_CURRENCY);
    expect(view.native).toBe(true);
    expect(view.tiers.map((t) => t.display)).toEqual([
      "₹500",
      "₹800",
      "₹900",
      "₹1000",
    ]);
    expect(view.range).toBe("₹500–₹1000");
  });

  it("says nothing about conversion, because nothing was converted", () => {
    expect(pricingFor(SCALE, "IN", null).note).toBeUndefined();
  });
});

describe("abroad, with a rate worth quoting", () => {
  it("converts and drops the concessional tier", () => {
    const view = pricingFor(SCALE, "US", USD, on("US"));
    expect(view.currency).toBe("USD");
    expect(view.native).toBe(false);
    // ₹800, ₹900, ₹1000 — the full band, no student rate.
    expect(view.tiers).toHaveLength(3);
    expect(view.tiers.every((t) => !t.student)).toBe(true);
    expect(view.tiers.map((t) => t.display)).toEqual(["$10", "$11", "$12"]);
    expect(view.range).toBe("$10–$12");
  });

  it("always says the invoice comes in rupees", () => {
    /*
      Not decoration. A figure in another currency is an estimate of an invoice
      that arrives in rupees; one that does not say so is a number someone will
      reasonably expect to be charged.
    */
    const view = pricingFor(SCALE, "AE", AED, on("AE"));
    expect(view.note).toBe(CONVERTED_NOTE);
    expect(view.note).toContain("INR");
  });

  it("keeps the rupee amount alongside whatever is displayed", () => {
    // Nothing downstream re-derives the price from the converted figure.
    const view = pricingFor(SCALE, "US", USD, on("US"));
    expect(view.tiers.map((t) => t.rupees)).toEqual([800, 900, 1000]);
  });
});

describe("abroad, with no rate worth quoting", () => {
  const cases: [string, FxRate | null][] = [
    ["no rate at all", null],
    ["a rate for the wrong currency", fresh("EUR", 0.0104)],
    [
      "a rate that has gone stale",
      { currency: "USD", perRupee: 0.0113, asOf: new Date(Date.now() - 40 * 86_400_000).toISOString() },
    ],
    ["a rate that is not a number", fresh("USD", Number.NaN)],
    ["a rate of zero", fresh("USD", 0)],
  ];

  it.each(cases)("falls back to rupees given %s", (_label, rate) => {
    const view = pricingFor(SCALE, "US", rate, on("US"));
    expect(view.native).toBe(true);
    expect(view.currency).toBe(PRACTICE_CURRENCY);
    expect(view.note).toBeUndefined();
    // Still the right tiers for where they are — the policy did not move.
    expect(view.tiers.map((t) => t.rupees)).toEqual([800, 900, 1000]);
    expect(view.tiers.map((t) => t.display)).toEqual(["₹800", "₹900", "₹1000"]);
  });

  it("falls back rather than showing a scale with tiers that read alike", () => {
    // A rate so small every tier rounds together: rupees say more than three
    // identical figures would.
    const view = pricingFor(SCALE, "KW", fresh("KWD", 1e-9), on("KW"));
    expect(view.native).toBe(true);
  });
});

describe("a country that means nothing", () => {
  it("shows rupees and the band, for anything unrecognised", () => {
    for (const country of ["", "ZZ", null, undefined, 42]) {
      const view = pricingFor(SCALE, country as unknown, USD, on("US"));
      expect(view.native, String(country)).toBe(true);
      // Unknown is not home, so no concessional rate.
      expect(view.tiers.some((t) => t.student), String(country)).toBe(false);
    }
  });
});
