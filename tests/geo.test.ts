import { describe, it, expect } from "vitest";
import { countryFromHeaders, COUNTRY_HEADER } from "@/lib/geo";
import { pricingFor } from "@/lib/pricing";
import { DEFAULT_SLIDING_SCALE } from "@/lib/rates";

const withCountry = (value?: string) =>
  new Headers(value === undefined ? {} : { [COUNTRY_HEADER]: value });

describe("reading the country off a request", () => {
  it("takes the code the edge resolved", () => {
    expect(countryFromHeaders(withCountry("US"))).toBe("US");
    expect(countryFromHeaders(withCountry("IN"))).toBe("IN");
  });

  it("takes it as it arrives rather than as it ought to be", () => {
    expect(countryFromHeaders(withCountry("gb"))).toBe("GB");
    expect(countryFromHeaders(withCountry(" ae "))).toBe("AE");
  });

  it("answers empty when there is nothing to trust", () => {
    for (const value of ["", "  ", "ZZZ", "U", "1N", "united states"]) {
      expect(countryFromHeaders(withCountry(value)), value).toBe("");
    }
    expect(countryFromHeaders(withCountry())).toBe("");
    expect(countryFromHeaders(null)).toBe("");
    expect(countryFromHeaders(undefined)).toBe("");
  });

  it("does not quietly call an unreadable header home", () => {
    /*
      "Unknown" and "India" are different facts, and the pricing rules draw a
      real line between them: defaulting to home would hand the concessional
      rate to everyone whose header failed to arrive.
    */
    const unknown = countryFromHeaders(withCountry("???"));
    expect(unknown).toBe("");
    const view = pricingFor([...DEFAULT_SLIDING_SCALE], unknown, null);
    expect(view.tiers.some((tier) => tier.student)).toBe(false);
  });

  it("does not read any other header", () => {
    // Vercel's is the only one the edge signs; anything else is caller-supplied.
    const spoofed = new Headers({
      "x-forwarded-for": "1.2.3.4",
      "cf-ipcountry": "IN",
      "x-country": "IN",
    });
    expect(countryFromHeaders(spoofed)).toBe("");
  });
});
