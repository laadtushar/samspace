import { describe, it, expect } from "vitest";
import {
  parseRate,
  formatRate,
  splitRate,
  rateAmount,
  priceRangeOf,
  isStudentRate,
} from "@/lib/rates";
import { fillTokens, fillDeep, rateValues, TOKENS } from "@/lib/tokens";
import { defaultContent, resolveContentTokens } from "@/lib/content";

describe("reading a rate", () => {
  it("takes the first amount, not every digit in the string", () => {
    // The bug this exists for: "₹500 (Student)  ₹600" read as 500600, and the
    // intake form advertised a sliding scale ending in it.
    expect(rateAmount("₹500 (Student)  ₹600")).toBe(500);
    expect(parseRate("₹500 (Student)  ₹600").extras).toEqual([600]);
  });

  it("reads an ordinary rate", () => {
    expect(parseRate("₹800")).toEqual({ amount: 800, label: "", extras: [] });
    expect(parseRate("₹500 (Student)")).toEqual({
      amount: 500,
      label: "Student",
      extras: [],
    });
  });

  it("copes with an entry that has no amount at all", () => {
    expect(parseRate("").amount).toBeNull();
    expect(parseRate("free").amount).toBeNull();
    expect(rateAmount(null)).toBeNull();
  });

  it("builds the stored form back", () => {
    expect(formatRate(500, "Student")).toBe("₹500 (Student)");
    expect(formatRate("800", "")).toBe("₹800");
    expect(formatRate("", "Student")).toBe("");
  });

  it("splits a row that holds two rates, keeping the label on the first", () => {
    expect(splitRate("₹500 (Student)  ₹600")).toEqual([
      "₹500 (Student)",
      "₹600",
    ]);
  });

  it("derives a range that a jammed entry cannot corrupt", () => {
    expect(priceRangeOf(["₹500 (Student)", "₹800", "₹1000"])).toBe("₹500–₹1000");
    expect(priceRangeOf(["₹500 (Student)  ₹600", "₹700"])).toBe("₹500–₹700");
    expect(priceRangeOf([])).toBe("");
  });

  it("recognises the concessional rate however it is labelled", () => {
    expect(isStudentRate("₹500 (Student)")).toBe(true);
    expect(isStudentRate("₹500 (student rate)")).toBe(true);
    expect(isStudentRate("₹800")).toBe(false);
  });
});

describe("prices written once and referenced everywhere", () => {
  const rates = ["₹500 (Student)", "₹800", "₹1000"];
  const values = rateValues(rates);

  it("resolves each documented token", () => {
    expect(fillTokens("{{rate.range}}", values)).toBe("₹500–₹1000");
    expect(fillTokens("{{rate.lowest}}", values)).toBe("₹500");
    expect(fillTokens("{{rate.highest}}", values)).toBe("₹1000");
    expect(fillTokens("{{rate.student}}", values)).toBe("₹500");
  });

  it("documents exactly the tokens it resolves", () => {
    for (const { token } of TOKENS) {
      const filled = fillTokens(token, values);
      expect(filled, token).not.toBe(token);
    }
  });

  it("tolerates spacing and case", () => {
    expect(fillTokens("{{ rate.range }}", values)).toBe("₹500–₹1000");
    expect(fillTokens("{{RATE.RANGE}}", values)).toBe("₹500–₹1000");
  });

  it("leaves a token it cannot resolve visible rather than blank", () => {
    // A visible {{rate.studnet}} is a typo someone can see and fix. An empty
    // gap in a sentence about money is not.
    expect(fillTokens("costs {{rate.studnet}}", values)).toBe(
      "costs {{rate.studnet}}"
    );
    const noStudent = rateValues(["₹800", "₹1000"]);
    expect(fillTokens("{{rate.student}}", noStudent)).toBe("{{rate.student}}");
  });

  it("reaches every string in a structure and leaves other types alone", () => {
    const filled = fillDeep(
      { a: "{{rate.range}}", b: [{ c: "{{rate.lowest}}" }], n: 500, z: null },
      values
    );
    expect(filled).toEqual({
      a: "₹500–₹1000",
      b: [{ c: "₹500" }],
      n: 500,
      z: null,
    });
  });
});

describe("resolving tokens for the public site", () => {
  it("fills them from the content's own rates", () => {
    const withTokens = {
      ...defaultContent,
      slidingScale: ["₹500 (Student)", "₹900"],
      faq: {
        ...defaultContent.faq,
        items: [{ question: "Cost?", answer: "Sessions are {{rate.range}}." }],
      },
    };
    const resolved = resolveContentTokens(withTokens);
    expect(resolved.faq.items[0].answer).toBe("Sessions are ₹500–₹900.");
  });

  it("changes the answer when the rates change, with no other edit", () => {
    // The whole point: one place to edit, and nowhere left to drift.
    const base = {
      ...defaultContent,
      faq: {
        ...defaultContent.faq,
        items: [{ question: "Cost?", answer: "From {{rate.lowest}}." }],
      },
    };
    const cheap = resolveContentTokens({ ...base, slidingScale: ["₹400", "₹900"] });
    const dear = resolveContentTokens({ ...base, slidingScale: ["₹700", "₹900"] });
    expect(cheap.faq.items[0].answer).toBe("From ₹400.");
    expect(dear.faq.items[0].answer).toBe("From ₹700.");
  });

  it("leaves content without tokens exactly as it was", () => {
    expect(resolveContentTokens(defaultContent)).toEqual(defaultContent);
  });
});
