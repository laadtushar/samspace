import { describe, it, expect } from "vitest";
import {
  PRACTICE_CURRENCY,
  money,
  formatMoney,
  formatMoneyRange,
  isCurrencyCode,
} from "@/lib/money";
import { formatRate, priceRangeOf, DEFAULT_SLIDING_SCALE } from "@/lib/rates";
import { rateValues } from "@/lib/tokens";

/**
 * The symbol is derived from the currency code, where it used to be typed into
 * four separate template literals.
 *
 * The first duty of this module is to change nothing. Everything below that
 * pins existing output is doing the real work of the change: if any of it moves,
 * a visitor sees a different price than they did yesterday, which is a decision
 * rather than a refactor.
 */
describe("rendering the practice's own currency", () => {
  it("renders exactly what the site already showed", () => {
    expect(formatMoney(500)).toBe("₹500");
    expect(formatMoney(800)).toBe("₹800");
    expect(formatMoney(1000)).toBe("₹1000");
    expect(formatMoneyRange(500, 1000)).toBe("₹500–₹1000");
  });

  it("keeps the site's convention of no grouping separator", () => {
    // ₹1,000 would be correct by the locale and wrong for this site, which has
    // always shown ₹1000 — on the page, in the rates list, in the dashboard.
    expect(formatMoney(1000)).not.toContain(",");
    expect(formatMoney(12345)).toBe("₹12345");
  });

  it("uses an en dash between the ends of a range", () => {
    expect(formatMoneyRange(500, 1000)).toContain("–");
    expect(formatMoneyRange(500, 1000)).not.toContain("-");
  });

  it("carries the symbol on both ends of a range", () => {
    // ₹500–1000 reads as a discount off ₹500 at a glance.
    expect(formatMoneyRange(500, 1000).match(/₹/g)).toHaveLength(2);
  });

  it("drops decimals a whole amount does not need", () => {
    expect(formatMoney(500)).toBe("₹500");
    expect(formatMoney(500)).not.toContain(".");
  });
});

describe("rendering any other currency", () => {
  it("uses the currency's own symbol and precision", () => {
    expect(formatMoney(12.5, "USD")).toBe("$12.50");
    expect(formatMoney(12, "AED")).toContain("12");
    // Intl knows the minor units: none for yen, three for the dinars.
    expect(formatMoney(1800.4, "JPY")).not.toContain(".");
    expect(formatMoney(12.345, "KWD")).toContain("12.345");
  });

  it("groups thousands where the practice's currency does not", () => {
    // A converted price in won or dong runs to five and six figures, where
    // separators are the difference between a number and a smear.
    expect(formatMoney(16000, "KRW")).toContain(",");
    expect(formatMoney(16000)).not.toContain(",");
  });

  it("says something rather than throwing on a code Intl refuses", () => {
    expect(formatMoney(500, "NOTACODE")).toBe("NOTACODE 500");
  });

  it("renders nothing for an amount that is not one", () => {
    expect(formatMoney(Number.NaN)).toBe("");
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe("");
  });
});

describe("the shape of a currency code", () => {
  it("accepts ISO 4217 and nothing else", () => {
    for (const good of ["INR", "USD", "AED", "KWD"]) {
      expect(isCurrencyCode(good), good).toBe(true);
    }
    for (const bad of ["inr", "IN", "INRR", "₹", "", " INR", 42, null]) {
      expect(isCurrencyCode(bad), String(bad)).toBe(false);
    }
  });

  it("agrees with what the database will accept", () => {
    // db/migrations/005 checks currency ~ '^[A-Z]{3}$'. Two rules that can
    // disagree is one more thing to get wrong.
    expect(isCurrencyCode(PRACTICE_CURRENCY)).toBe(true);
  });
});

describe("everything that used to type a rupee sign", () => {
  it("builds a rate the same way it always did", () => {
    expect(formatRate(500, "Student")).toBe("₹500 (Student)");
    expect(formatRate(800)).toBe("₹800");
    expect(formatRate("₹900")).toBe("₹900");
    expect(formatRate("")).toBe("");
  });

  it("ships the same scale it always did", () => {
    expect([...DEFAULT_SLIDING_SCALE]).toEqual([
      "₹500 (Student)",
      "₹800",
      "₹900",
      "₹1000",
    ]);
  });

  it("builds the range the same way it always did", () => {
    expect(priceRangeOf([...DEFAULT_SLIDING_SCALE])).toBe("₹500–₹1000");
  });

  it("resolves the tokens to the same strings they always did", () => {
    expect(rateValues([...DEFAULT_SLIDING_SCALE])).toEqual({
      "rate.range": "₹500–₹1000",
      "rate.lowest": "₹500",
      "rate.highest": "₹1000",
      "rate.student": "₹500",
      "rate.band": "₹800–₹1000",
      "rate.standard": "₹800",
    });
  });

  it("makes money() and a bare number mean the same thing", () => {
    expect(formatMoney(money(500))).toBe(formatMoney(500));
    expect(formatMoney(money(12.5, "USD"))).toBe(formatMoney(12.5, "USD"));
  });
});
