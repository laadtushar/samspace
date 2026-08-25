import { describe, it, expect } from "vitest";
import {
  reprice,
  rewriteText,
  isRate,
  normalizeAmount,
  RATE_PATTERN,
} from "../lib/reprice";

describe("rewriting a rate inside a string", () => {
  it("replaces every occurrence, not only the first", () => {
    expect(
      rewriteText("₹500 for students. The ₹500 rate is self-declared.", "₹500", "₹600")
    ).toBe("₹600 for students. The ₹600 rate is self-declared.");
  });

  it("leaves a longer amount that merely starts the same alone", () => {
    // The whole reason for the lookahead: ₹5000 starts with ₹500, and a naive
    // replace would turn the top of the scale into ₹6000.
    expect(rewriteText("₹500–₹5000", "₹500", "₹600")).toBe("₹600–₹5000");
  });

  it("does not touch a bare number without the symbol", () => {
    expect(rewriteText("500 words", "₹500", "₹600")).toBe("500 words");
  });

  it("returns the string unchanged when the amount is absent", () => {
    const text = "Sessions run on a sliding scale.";
    expect(rewriteText(text, "₹500", "₹600")).toBe(text);
  });
});

describe("rewriting a whole structure", () => {
  const content = {
    slidingScale: ["₹500 (Student)", "₹800", "₹1000"],
    services: { items: [{ title: "Therapy", price: "₹500–₹1000", tags: ["₹500 student rate"] }] },
    faq: { items: [{ question: "What does it cost?", answer: "From ₹500." }] },
    calendlyUrl: "https://calendly.com/x",
    minPrice: 500,
  };

  it("reaches every string however deeply nested", () => {
    const { value } = reprice(content, "₹500", "₹600");
    expect(value.slidingScale[0]).toBe("₹600 (Student)");
    expect(value.services.items[0].price).toBe("₹600–₹1000");
    expect(value.services.items[0].tags[0]).toBe("₹600 student rate");
    expect(value.faq.items[0].answer).toBe("From ₹600.");
  });

  it("leaves numbers and unrelated strings alone", () => {
    const { value } = reprice(content, "₹500", "₹600");
    expect(value.minPrice).toBe(500);
    expect(value.calendlyUrl).toBe("https://calendly.com/x");
    expect(value.faq.items[0].question).toBe("What does it cost?");
  });

  it("does not mutate what it was given", () => {
    reprice(content, "₹500", "₹600");
    expect(content.slidingScale[0]).toBe("₹500 (Student)");
  });

  it("reports each edit with a path a person can read", () => {
    const { changes } = reprice(content, "₹500", "₹600");
    const paths = changes.map((c) => c.path);
    expect(paths).toContain("slidingScale[0]");
    expect(paths).toContain("services.items[0].price");
    expect(paths).toContain("faq.items[0].answer");
    expect(changes).toHaveLength(4);
  });

  it("reports nothing when the amount does not appear", () => {
    const { changes } = reprice(content, "₹700", "₹900");
    expect(changes).toEqual([]);
  });

  it("survives null and undefined without throwing", () => {
    const { value } = reprice({ a: null, b: undefined, c: "₹500" }, "₹500", "₹600");
    expect(value).toEqual({ a: null, b: undefined, c: "₹600" });
  });
});

describe("what counts as a rate", () => {
  it("accepts plain rupee amounts", () => {
    for (const rate of ["₹500", "₹600", "₹1000", "₹12000"]) {
      expect(isRate(rate)).toBe(true);
      expect(RATE_PATTERN.test(rate)).toBe(true);
    }
  });

  it("rejects anything that would make this a general find-and-replace", () => {
    for (const bad of [
      "₹500 (Student)",
      "500",
      "Sessions",
      "₹",
      "₹5",
      "₹500–₹1000",
      "₹500\n₹600",
      "",
    ]) {
      expect(isRate(bad)).toBe(false);
    }
  });
});

describe("reading what someone typed", () => {
  it("accepts a bare number, which is what a phone keyboard makes easy", () => {
    // The bug this exists for: the field demanded ₹500, the person typed 500,
    // and the button stayed disabled with nothing saying why.
    expect(normalizeAmount("500")).toBe("₹500");
    expect(normalizeAmount(600)).toBe("₹600");
  });

  it("accepts the symbol too, however it is spaced", () => {
    expect(normalizeAmount("₹500")).toBe("₹500");
    expect(normalizeAmount("  ₹500  ")).toBe("₹500");
    expect(normalizeAmount("₹ 500")).toBe("₹500");
  });

  it("returns nothing for anything that is not a plain amount", () => {
    for (const bad of ["", "   ", "₹", "5", "abc", "₹500–₹1000", "500 (Student)", "5.5", "-500", null, undefined, {}]) {
      expect(normalizeAmount(bad)).toBe("");
    }
  });

  it("agrees with the rate pattern on everything it accepts", () => {
    for (const input of ["500", "₹600", " 1000 ", "12000"]) {
      expect(isRate(normalizeAmount(input))).toBe(true);
    }
  });
});

describe("the shipped defaults can be repriced end to end", () => {
  it("moves the whole scale to a new lowest rate", async () => {
    const { defaultContent } = await import("../lib/content");
    const lowest = defaultContent.slidingScale[0].match(/₹\d+/)?.[0];
    expect(lowest).toBeTruthy();

    const { value, changes } = reprice(defaultContent, lowest!, "₹750");
    expect(changes.length).toBeGreaterThan(0);
    expect(JSON.stringify(value)).not.toContain(lowest!);
    // ...and nothing that merely contains those digits went with it.
    expect(value.slidingScale.at(-1)).toBe(defaultContent.slidingScale.at(-1));
  });
});
