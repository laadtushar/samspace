import { describe, it, expect } from "vitest";
import { previewFor } from "@/lib/country-preview";
import { defaultRule, type CountryRule } from "@/lib/country-pricing";
import { DEFAULT_SLIDING_SCALE } from "@/lib/rates";
import { currenciesInUse } from "@/lib/country-currency";
import type { FxRate } from "@/lib/convert";

/**
 * The settings page's account of what a country sees.
 *
 * Its whole value is that it cannot be wrong: the figures come from the same
 * call the public endpoint makes. What these tests hold is the other half —
 * that whenever it shows rupees it also says why, and that the why matches the
 * thing that actually stopped it.
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
  source: "feed",
});

describe("showing a converted country", () => {
  it("gives the figures a visitor there is actually served", () => {
    const preview = previewFor(SCALE, rule({ enabled: true }), fresh("AED", 0.0415));
    expect(preview.view.native).toBe(false);
    expect(preview.view.currency).toBe("AED");
    expect(preview.reason).toBe("");
  });

  it("shows the rupee figures the conversion starts from", () => {
    // What someone needs to check a markup: the number being converted, not
    // just the result.
    const preview = previewFor(
      SCALE,
      rule({ enabled: true, markupPercent: 50 }),
      fresh("AED", 0.0415)
    );
    expect(preview.basis).toEqual(["₹750 (Student)", "₹1200", "₹1350", "₹1500"]);
  });

  it("shows an override as the basis, untouched by any markup", () => {
    const preview = previewFor(
      SCALE,
      rule({ enabled: true, markupPercent: 50, overrideScale: ["₹1111"] }),
      fresh("AED", 0.0415)
    );
    expect(preview.basis).toEqual(["₹1111"]);
  });
});

describe("saying why a country is in rupees", () => {
  it("always gives a reason when it falls back, and never when it does not", () => {
    /*
      The property that matters, checked across every country the map knows
      rather than a handful: a settings page that shows a fallback without a
      reason sends someone to re-enter a rate that was never the problem.
    */
    const rate = fresh("AED", 0.0415);
    for (const country of ["AE", "US", "IN", "ZZ", "GB", "KW"]) {
      for (const enabled of [true, false]) {
        const preview = previewFor(SCALE, rule({ country, enabled }), rate);
        expect(preview.view.native === (preview.reason !== ""), `${country} ${enabled}`)
          .toBe(true);
      }
    }
  });

  it("blames the switch first, because that is what someone must fix first", () => {
    // Not enabled and no rate: telling them about the rate sends them to fix
    // the wrong thing.
    const preview = previewFor(SCALE, rule({ enabled: false }), null);
    expect(preview.reason).toContain("Not enabled");
  });

  it("says home is already billed in rupees", () => {
    const preview = previewFor(SCALE, rule({ country: "IN", enabled: true }), null);
    expect(preview.reason).toContain("Already billed in rupees");
  });

  it("names the currency that has no rate yet", () => {
    const preview = previewFor(SCALE, rule({ country: "AE", enabled: true }), null);
    expect(preview.reason).toContain("AED");
    expect(preview.reason).toContain("No AED rate yet");
  });

  it("says how old a stale rate is, and what the limit was", () => {
    const stale = {
      ...fresh("AED", 0.0415),
      asOf: new Date(Date.now() - 40 * 86_400_000).toISOString(),
    };
    const preview = previewFor(SCALE, rule({ enabled: true }), stale);
    expect(preview.reason).toMatch(/\d+ days old/);
    expect(preview.reason).toContain("limit");
  });

  it("points at the stored value when a rate's date will not parse", () => {
    const broken = { ...fresh("AED", 0.0415), asOf: "not a date" };
    const preview = previewFor(SCALE, rule({ enabled: true }), broken);
    expect(preview.reason).toContain("no readable date");
  });

  it("says when a rate is for the wrong currency altogether", () => {
    const preview = previewFor(SCALE, rule({ enabled: true }), fresh("USD", 0.0113));
    expect(preview.reason).toContain("USD");
    expect(preview.reason).toContain("AED");
  });

  it("explains a conversion that would flatten the tiers", () => {
    // Every other condition passes, so this is the only thing left.
    const preview = previewFor(
      SCALE,
      rule({ country: "KW", enabled: true }),
      fresh("KWD", 1e-9)
    );
    expect(preview.view.native).toBe(true);
    expect(preview.reason).toContain("read alike");
  });
});

describe("across the countries the site actually knows", () => {
  it("names a currency for every one of them", () => {
    // A country that resolves to nothing would preview as rupees with a
    // reason nobody could act on.
    for (const currency of currenciesInUse()) {
      expect(currency).toMatch(/^[A-Z]{3}$/);
    }
    expect(currenciesInUse().length).toBeGreaterThan(50);
  });
});
