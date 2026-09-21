import { describe, it, expect } from "vitest";
import {
  currencyForCountry,
  currenciesInUse,
  isCountryCode,
  MAPPED_COUNTRY_COUNT,
} from "@/lib/country-currency";
import { PRACTICE_CURRENCY, formatMoney } from "@/lib/money";

/**
 * Which money a visitor thinks in.
 *
 * A wrong currency here is worse than no currency: it prints a figure with the
 * wrong symbol on it and nothing looks broken. So the shape of every entry is
 * checked mechanically, and the entries most easily got wrong — shared
 * currencies, countries using someone else's money — are checked by name.
 */
describe("resolving a country to a currency", () => {
  it("answers in rupees for India, which is what the practice charges", () => {
    expect(currencyForCountry("IN")).toBe(PRACTICE_CURRENCY);
  });

  it("knows the countries a visitor is most likely to come from", () => {
    const expected = {
      US: "USD", GB: "GBP", AE: "AED", CA: "CAD", AU: "AUD", SG: "SGD",
      DE: "EUR", JP: "JPY", SA: "SAR", QA: "QAR", NZ: "NZD", ZA: "ZAR",
    };
    for (const [country, currency] of Object.entries(expected)) {
      expect(currencyForCountry(country), country).toBe(currency);
    }
  });

  it("puts every eurozone member on the euro", () => {
    // Twenty members, and a map that gets one wrong prints francs in France.
    const eurozone = [
      "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE",
      "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
    ];
    expect(eurozone).toHaveLength(20);
    for (const country of eurozone) {
      expect(currencyForCountry(country), country).toBe("EUR");
    }
  });

  it("follows countries that use another country's money", () => {
    // The entries most easily missed, because the currency is not named after
    // the country that spends it.
    const borrowed = {
      EC: "USD", PA: "USD", SV: "USD", PR: "USD",
      LI: "CHF", MC: "EUR", ME: "EUR", XK: "EUR",
      NR: "AUD", TV: "AUD", CK: "NZD",
    };
    for (const [country, currency] of Object.entries(borrowed)) {
      expect(currencyForCountry(country), country).toBe(currency);
    }
  });

  it("uses the shared African francs where they are shared", () => {
    for (const country of ["SN", "CI", "ML", "BF", "NE", "TG", "BJ", "GW"]) {
      expect(currencyForCountry(country), country).toBe("XOF");
    }
    for (const country of ["CM", "GA", "CG", "TD", "CF", "GQ"]) {
      expect(currencyForCountry(country), country).toBe("XAF");
    }
  });
});

describe("what happens when the country is not usable", () => {
  it("falls back to rupees rather than guessing", () => {
    for (const value of ["", "ZZ", "XX", "USA", "u", null, undefined, 42, {}]) {
      expect(currencyForCountry(value as unknown), String(value)).toBe(
        PRACTICE_CURRENCY
      );
    }
  });

  it("takes a header as it arrives, not as it ought to be", () => {
    // Vercel sends "US"; nothing guarantees case or trimming further upstream.
    expect(currencyForCountry("us")).toBe("USD");
    expect(currencyForCountry(" gb ")).toBe("GBP");
  });
});

describe("the map itself", () => {
  it("holds only well-formed entries", () => {
    // Shape rather than correctness, but a typo in either half shows up here.
    for (const currency of currenciesInUse()) {
      expect(currency, currency).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("names only currencies Intl will accept", () => {
    /*
      The guard against a typo'd or retired code reaching a price. Checked by
      asking Intl directly rather than by inspecting the output: several real
      currencies have no symbol in English and format as "BYN 1,234", which is
      indistinguishable at a glance from formatMoney's fallback for a code it
      could not use at all.
    */
    for (const currency of currenciesInUse()) {
      expect(() => {
        new Intl.NumberFormat("en", { style: "currency", currency }).format(1);
      }, currency).not.toThrow();
      expect(formatMoney(1234, currency), currency).toBeTruthy();
    }
  });

  it("would catch a code Intl does not know", () => {
    // Guarding the guard: the check above has to be able to fail.
    expect(() => {
      new Intl.NumberFormat("en", { style: "currency", currency: "ZZZZ" }).format(1);
    }).toThrow();
  });

  it("does not offer rupees as something to convert into", () => {
    expect(currenciesInUse()).not.toContain(PRACTICE_CURRENCY);
  });

  it("covers enough of the world to be worth having", () => {
    // Not an exact count — the map will grow. A floor catches it shrinking by
    // accident, which is the change nobody notices.
    expect(MAPPED_COUNTRY_COUNT).toBeGreaterThan(150);
    expect(currenciesInUse().length).toBeGreaterThan(80);
  });

  it("validates a country code the same way everywhere", () => {
    for (const good of ["IN", "US", "AE"]) expect(isCountryCode(good)).toBe(true);
    for (const bad of ["in", "I", "IND", "", "1N", null]) {
      expect(isCountryCode(bad as unknown), String(bad)).toBe(false);
    }
  });
});
