import { describe, it, expect } from "vitest";
import {
  DEFAULT_SLIDING_SCALE,
  fullRates,
  studentRates,
  priceRangeOf,
} from "@/lib/rates";
import { rateValues, TOKENS } from "@/lib/tokens";
import { auditPrices, groupFindings, walkStrings } from "@/lib/price-audit";
import { parsePath, valueAtPath, withValueAtPath } from "@/lib/content-path";
import { pricingFrom } from "@/lib/seo-pricing";
import { publicPost, publicPosts } from "@/lib/posts-public";
import { defaultContent, type SiteContent } from "@/lib/default-content";

/**
 * The scale is two things: a concessional rate, and the band left over. Copy has
 * to be able to say either without typing a figure, which is what these tokens
 * are for, and the audit is what catches copy that typed one anyway.
 */
describe("the scale splits into a student rate and a band", () => {
  const scale = ["₹500 (Student)", "₹800", "₹900", "₹1000"];

  it("separates the concessional rate from the rest", () => {
    expect(studentRates(scale)).toEqual(["₹500 (Student)"]);
    expect(fullRates(scale)).toEqual(["₹800", "₹900", "₹1000"]);
  });

  it("resolves the band and the lowest full rate", () => {
    const values = rateValues(scale);
    expect(values["rate.range"]).toBe("₹500–₹1000");
    expect(values["rate.student"]).toBe("₹500");
    expect(values["rate.band"]).toBe("₹800–₹1000");
    expect(values["rate.standard"]).toBe("₹800");
  });

  it("treats every rate as a full rate when none is concessional", () => {
    const values = rateValues(["₹800", "₹1000"]);
    expect(values["rate.band"]).toBe("₹800–₹1000");
    expect(values["rate.standard"]).toBe("₹800");
    expect(values["rate.student"]).toBeUndefined();
  });

  it("collapses to a single figure when the band is one rate", () => {
    const values = rateValues(["₹500 (Student)", "₹800"]);
    expect(values["rate.band"]).toBe("₹800–₹800");
    expect(values["rate.standard"]).toBe("₹800");
  });

  it("resolves nothing from a scale with no amounts", () => {
    expect(rateValues([])).toEqual({});
    expect(rateValues(["free"])).toEqual({});
  });

  it("documents every token it resolves", () => {
    const resolved = Object.keys(rateValues(scale)).sort();
    const documented = TOKENS.map((t) =>
      t.token.replace(/[{}]/g, "").trim().toLowerCase()
    ).sort();
    expect(documented).toEqual(resolved);
  });
});

describe("auditing copy for a price the scale no longer has", () => {
  const scale = ["₹500 (Student)", "₹800", "₹900", "₹1000"];

  it("passes copy that agrees with the scale", () => {
    const content = {
      slidingScale: scale,
      faq: {
        items: [
          { answer: "The scale runs ₹500–₹1000, and ₹800–₹1000 if you're earning." },
        ],
      },
    };
    expect(auditPrices(content, scale)).toEqual([]);
  });

  it("finds the range the live site actually got wrong", () => {
    // The scale said ₹500 for students; the FAQ two sections below said ₹600.
    const content = {
      slidingScale: scale,
      faq: {
        items: [
          { answer: "Sessions run on a sliding scale of ₹600–₹1000." },
          { answer: "The ₹600 rate is reserved for students." },
        ],
      },
    };
    const findings = auditPrices(content, scale);
    expect(findings).toHaveLength(2);
    expect(findings[0].path).toBe("faq.items[0].answer");
    expect(findings[0].problem).toContain("₹600–₹1000");
    expect(findings[1].path).toBe("faq.items[1].answer");
    expect(findings[1].problem).toContain("₹600");
  });

  it("reports a stale range once rather than for each figure in it", () => {
    const content = {
      slidingScale: scale,
      faq: { items: [{ answer: "The scale runs ₹600–₹1200." }] },
    };
    // Both figures are wrong, but there is one sentence to fix.
    expect(auditPrices(content, scale)).toHaveLength(1);
  });

  it("asks a service price that repeats the scale to use the token", () => {
    const content = {
      slidingScale: scale,
      services: { items: [{ price: "₹500–₹1000" }, { price: "₹800–₹1000" }] },
    };
    const findings = auditPrices(content, scale);
    expect(findings).toHaveLength(2);
    expect(findings[0].problem).toContain("{{rate.range}}");
    expect(findings[1].problem).toContain("{{rate.band}}");
  });

  it("leaves a service priced as its own range alone", () => {
    const content = {
      slidingScale: scale,
      services: { items: [{ price: "₹1200–₹1500" }] },
    };
    expect(auditPrices(content, scale)).toEqual([]);
  });

  it("never reports the scale disagreeing with itself", () => {
    expect(auditPrices({ slidingScale: scale }, scale)).toEqual([]);
  });

  it("lets copy name a price a service declares", () => {
    const content = {
      slidingScale: scale,
      services: { items: [{ price: "₹1200" }] },
      mentoring: { subtext: "Mentoring is ₹1200 a session." },
    };
    expect(auditPrices(content, scale)).toEqual([]);
  });

  it("flags an amount no rate on the site supports", () => {
    const content = {
      slidingScale: scale,
      services: { items: [{ price: "₹1200" }] },
      mentoring: { subtext: "Mentoring is ₹1500 a session." },
    };
    const findings = auditPrices(content, scale);
    expect(findings).toHaveLength(1);
    expect(findings[0].path).toBe("mentoring.subtext");
  });

  it("says nothing about copy that uses a token", () => {
    const content = {
      slidingScale: scale,
      faq: { items: [{ answer: "The scale runs {{rate.range}}." }] },
    };
    expect(auditPrices(content, scale)).toEqual([]);
  });

  it("reports nothing when there is no scale to compare against", () => {
    expect(auditPrices({ faq: { items: [{ answer: "₹600" }] } }, [])).toEqual([]);
  });

  it("collects everything wrong with one sentence under that sentence", () => {
    const content = {
      slidingScale: scale,
      faq: {
        items: [
          { answer: "The scale runs ₹600–₹1200, and the ₹550 rate is for students." },
        ],
      },
    };
    const grouped = groupFindings(auditPrices(content, scale));
    expect(grouped).toHaveLength(1);
    expect(grouped[0].path).toBe("faq.items[0].answer");
    expect(grouped[0].problems).toHaveLength(2);
  });

  it("walks to every string with a readable path", () => {
    const seen: string[] = [];
    walkStrings({ a: { b: ["x", { c: "y" }] }, n: 1 }, (path) => seen.push(path));
    expect(seen).toEqual(["a.b[0]", "a.b[1].c"]);
  });
});

describe("addressing one field of content", () => {
  it("parses a path the audit reports", () => {
    expect(parsePath("faq.items[1].answer")).toEqual(["faq", "items", 1, "answer"]);
    expect(parsePath("studentNote")).toEqual(["studentNote"]);
  });

  it("refuses anything that is not a field path", () => {
    for (const bad of [
      "",
      "__proto__.x",
      "a.__proto__",
      "constructor.prototype",
      "faq.items[1",
      "faq..answer",
      "1faq",
      "faq['items']",
      null,
      42,
    ]) {
      expect(parsePath(bad as unknown), String(bad)).toBeNull();
    }
  });

  it("reads the value a path points at", () => {
    const segments = parsePath("faq.items[1].answer")!;
    expect(valueAtPath(defaultContent, segments)).toBe(
      defaultContent.faq.items[1].answer
    );
    expect(valueAtPath(defaultContent, parsePath("faq.items[99].answer")!)).toBeUndefined();
    expect(valueAtPath(defaultContent, parsePath("nope")!)).toBeUndefined();
  });

  it("replaces one field and leaves the original alone", () => {
    const segments = parsePath("faq.items[1].answer")!;
    const before = defaultContent.faq.items[1].answer;
    const next = withValueAtPath(defaultContent, segments, "replaced") as SiteContent;

    expect(next.faq.items[1].answer).toBe("replaced");
    expect(defaultContent.faq.items[1].answer).toBe(before);
    // Untouched branches are shared rather than rebuilt.
    expect(next.hero).toBe(defaultContent.hero);
    expect(next.faq.items[0]).toBe(defaultContent.faq.items[0]);
  });

  it("will not invent a field that does not exist", () => {
    expect(withValueAtPath(defaultContent, parsePath("nope")!, "x")).toBeNull();
    expect(
      withValueAtPath(defaultContent, parsePath("faq.items[99].answer")!, "x")
    ).toBeNull();
  });
});

describe("the prices published as structured data", () => {
  const withScale = (
    slidingScale: string[],
    prices: (string | null)[] = ["{{rate.range}}", "₹1000", null]
  ) =>
    ({
      ...defaultContent,
      slidingScale,
      services: {
        items: prices.map((price, i) => ({
          title: `Service ${i}`,
          price,
          unit: null,
          tags: [],
        })),
      },
    }) as unknown as SiteContent;

  it("reads the therapy range off the scale", () => {
    const price = pricingFrom(withScale(["₹500 (Student)", "₹800", "₹1000"]));
    expect(price.range).toBe("₹500–₹1000");
    expect(price.lowest).toBe(500);
    expect(price.highest).toBe(1000);
  });

  it("follows the scale when it changes", () => {
    const price = pricingFrom(withScale(["₹700 (Student)", "₹1200"]));
    expect(price.range).toBe("₹700–₹1200");
    expect(price.lowest).toBe(700);
    expect(price.highest).toBe(1200);
  });

  it("takes the mentoring price from the one service quoting a single figure", () => {
    expect(pricingFrom(withScale([...DEFAULT_SLIDING_SCALE])).mentoring).toBe(1000);
  });

  it("publishes no mentoring price when which one it is, is unclear", () => {
    const two = withScale([...DEFAULT_SLIDING_SCALE], ["₹1000", "₹1500", null]);
    expect(pricingFrom(two).mentoring).toBeNull();
    const none = withScale([...DEFAULT_SLIDING_SCALE], ["{{rate.range}}", null, null]);
    expect(pricingFrom(none).mentoring).toBeNull();
  });

  it("publishes nothing rather than a wrong figure for an empty scale", () => {
    const price = pricingFrom(withScale([]));
    expect(price.range).toBe("");
    expect(price.lowest).toBeNull();
    expect(price.highest).toBeNull();
  });

  it("agrees with the scale the site ships with", () => {
    const price = pricingFrom(defaultContent);
    expect(price.range).toBe(priceRangeOf([...DEFAULT_SLIDING_SCALE]));
    expect(price.lowest).toBe(500);
    expect(price.highest).toBe(1000);
  });
});

describe("posts on the way to a reader", () => {
  const scale = ["₹500 (Student)", "₹800", "₹1000"];
  const post = {
    slug: "a-post",
    title: "Therapy from {{rate.range}}",
    excerpt: "Sessions run {{rate.range}}.",
    content: "Students pay {{rate.student}}; everyone else {{rate.band}}.",
    tags: ["{{rate.range}}"],
  };

  it("fills tokens in every field a reader sees", () => {
    const filled = publicPost(post, scale);
    expect(filled.title).toBe("Therapy from ₹500–₹1000");
    expect(filled.excerpt).toBe("Sessions run ₹500–₹1000.");
    expect(filled.content).toBe("Students pay ₹500; everyone else ₹800–₹1000.");
    expect(filled.tags).toEqual(["₹500–₹1000"]);
  });

  it("leaves the stored post untouched", () => {
    const [filled] = publicPosts([post], scale);
    expect(filled.title).toBe("Therapy from ₹500–₹1000");
    expect(post.title).toBe("Therapy from {{rate.range}}");
  });

  it("leaves a token it cannot resolve visible rather than blank", () => {
    expect(publicPost({ title: "{{rate.studnet}}" }, scale).title).toBe(
      "{{rate.studnet}}"
    );
  });
});
