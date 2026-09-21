import { describe, it, expect, vi, beforeEach } from "vitest";
import { COUNTRY_HEADER } from "@/lib/geo";
import { CONVERTED_NOTE } from "@/lib/pricing";

/**
 * The endpoint the page asks what its rupee figures should read as.
 *
 * Content is stubbed the way the intake route's is: the cached accessor needs a
 * Next request context, and the point here is the route's own decisions.
 */
const siteContent = vi.fn();
const storedRate = vi.fn();
const storedRule = vi.fn();

vi.mock("@/lib/content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content")>();
  return { ...actual, getCachedContent: () => siteContent() };
});

/*
  The rate store stands in for itself. There is no feed — rates are set by the
  practice — so what matters here is that the route asks for one, uses it when
  there is one, and stays in rupees when there is not.
*/
vi.mock("@/lib/fx-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/fx-store")>()),
  rateFor: (currency: string) => storedRate(currency),
}));

/*
  Likewise the country settings. A rate existing is not a decision to quote in
  it — the practice enables a country — so the route has to ask both, and a
  test that only sets a rate is testing a country nobody turned on.
*/
vi.mock("@/lib/country-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/country-store")>()),
  ruleFor: (country: unknown) => storedRule(country),
}));

const enabled = (country: string) => ({
  country,
  enabled: true,
  markupPercent: 0,
  overrideScale: null,
});

const { GET } = await import("@/app/api/pricing/route");

const ask = (country?: string) =>
  GET(
    new Request("https://www.samvritispace.com/api/pricing", {
      headers: country ? { [COUNTRY_HEADER]: country } : {},
    })
  );

beforeEach(() => {
  siteContent.mockReset().mockImplementation(async () => {
    const { defaultContent, resolveContentTokens } = await import("@/lib/content");
    return resolveContentTokens(defaultContent);
  });
  // No rate stored is the default, and the honest answer then is rupees.
  storedRate.mockReset().mockResolvedValue(null);
  // Nothing decided about any country is likewise the default: rupees.
  storedRule.mockReset().mockResolvedValue(null);
});

describe("pricing a request", () => {
  it("prices in rupees at home, concessional tier included", async () => {
    const view = await (await ask("IN")).json();
    expect(view.currency).toBe("INR");
    expect(view.native).toBe(true);
    expect(view.tiers.map((t: { display: string }) => t.display)).toEqual([
      "₹500",
      "₹800",
      "₹900",
      "₹1000",
    ]);
  });

  it("drops the concessional tier for everyone else", async () => {
    for (const country of ["US", "GB", "AE"]) {
      const view = await (await ask(country)).json();
      expect(
        view.tiers.some((t: { student: boolean }) => t.student),
        country
      ).toBe(false);
      expect(view.tiers, country).toHaveLength(3);
    }
  });

  it("prices in rupees while no rate source is configured", async () => {
    // The tier rules apply regardless; only the currency waits on a rate.
    const view = await (await ask("US")).json();
    expect(view.currency).toBe("INR");
    expect(view.note).toBeUndefined();
    expect(view.note).not.toBe(CONVERTED_NOTE);
  });

  it("treats a missing or unreadable country as not-home", async () => {
    for (const country of [undefined, "", "ZZZ"]) {
      const view = await (await ask(country)).json();
      expect(
        view.tiers.some((t: { student: boolean }) => t.student),
        String(country)
      ).toBe(false);
    }
  });

  it("keeps the rupee amount next to every figure", async () => {
    const view = await (await ask("US")).json();
    expect(view.tiers.map((t: { rupees: number }) => t.rupees)).toEqual([
      800, 900, 1000,
    ]);
  });
});

describe("how the answer is cached", () => {
  it("varies on the country, so one response serves a whole country", async () => {
    const res = await ask("US");
    expect(res.headers.get("Vary")).toBe(COUNTRY_HEADER);
  });

  it("is cached at the edge rather than per visitor", async () => {
    /*
      CDN-Cache-Control, not Cache-Control. Next emits its own
      `Cache-Control: no-store` for any dynamic route and setting a second one
      does not replace it — the response goes out with both, and a cache reading
      two conflicting values takes the first. Found by reading the headers a
      real build actually served.
    */
    const edge = (await ask("US")).headers.get("CDN-Cache-Control") ?? "";
    expect(edge).toContain("s-maxage=");
    expect(edge).toContain("public");
    expect(edge).not.toContain("no-store");
  });

  it("does not set a Cache-Control of its own to collide with Next's", async () => {
    /*
      The regression that would silently switch edge caching off again. The
      route sets none at all — Next adds `no-store` when it serves — so what is
      asserted is that nothing here tries to set a second one.
    */
    expect((await ask("US")).headers.get("Cache-Control") ?? "").not.toContain(
      "s-maxage"
    );
  });

  it("says which country it priced for", async () => {
    expect((await ask("AE")).headers.get("X-Priced-For")).toBe("AE");
    expect((await ask()).headers.get("X-Priced-For")).toBe("unknown");
  });
});

describe("when content cannot be read", () => {
  it("still answers, with the shipped scale", async () => {
    // A storage hiccup should cost a conversion, not the prices themselves.
    siteContent.mockRejectedValue(new Error("blob unavailable"));
    const res = await ask("IN");
    expect(res.status).toBe(200);
    const view = await res.json();
    expect(view.tiers.length).toBeGreaterThan(0);
    expect(view.range).toBe("₹500–₹1000");
  });
});


describe("a rate the practice has set", () => {
  const manual = (currency: string, perRupee: number) => ({
    currency,
    perRupee,
    asOf: new Date().toISOString(),
    source: "manual" as const,
    updatedAt: new Date().toISOString(),
  });

  it("converts the scale for a visitor whose currency has one", async () => {
    /*
      The whole point of storing rates. Before there was anywhere to keep one
      this route passed null and every country was quoted in rupees.
    */
    storedRate.mockResolvedValue(manual("USD", 0.0115));
    storedRule.mockResolvedValue(enabled("US"));

    const res = await ask("US");
    const view = await res.json();

    expect(storedRate).toHaveBeenCalledWith("USD");
    expect(view.currency).toBe("USD");
    expect(view.native).toBe(false);
    expect(view.note).toBe(CONVERTED_NOTE);
    // Every figure reads as dollars, and none of them reads as rupees.
    for (const tier of view.tiers) expect(tier.display).not.toContain("₹");
  });

  it("keeps the rupee amount as the thing actually charged", async () => {
    // The converted figure is guidance. The invoice is in rupees, and nothing
    // downstream may re-derive the amount from what was displayed.
    storedRate.mockResolvedValue(manual("USD", 0.0115));
    storedRule.mockResolvedValue(enabled("US"));

    const view = await (await ask("US")).json();
    expect(view.tiers.map((t: { rupees: number }) => t.rupees)).toEqual([
      800, 900, 1000,
    ]);
  });

  it("does not offer the concessional tier abroad, rate or no rate", async () => {
    // Policy, not presentation. It is funded by Indian clients choosing to pay
    // more, and a rate feed coming up must never change who it is offered to.
    storedRate.mockResolvedValue(manual("USD", 0.0115));
    storedRule.mockResolvedValue(enabled("US"));

    const view = await (await ask("US")).json();
    expect(view.tiers.some((t: { student: boolean }) => t.student)).toBe(false);
  });

  it("stays in rupees when that currency has no rate", async () => {
    storedRate.mockResolvedValue(null);

    const view = await (await ask("US")).json();
    expect(view.currency).toBe("INR");
    expect(view.native).toBe(true);
    expect(view.note).toBeUndefined();
  });

  it("stays in rupees when the rate is too old to quote", async () => {
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
    storedRate.mockResolvedValue({ ...manual("USD", 0.0115), asOf: old });
    storedRule.mockResolvedValue(enabled("US"));

    const view = await (await ask("US")).json();
    expect(view.currency).toBe("INR");
  });

  it("never asks for a rate at home", async () => {
    // Converting rupees into rupees is not a conversion, and asking would be a
    // database read on the most common request this route serves.
    await ask("IN");
    expect(storedRate).toHaveBeenCalledWith("INR");
    const view = await (await ask("IN")).json();
    expect(view.native).toBe(true);
  });

  it("prices in rupees when the rate cannot be read at all", async () => {
    /*
      A database hiccup should cost the conversion and nothing else. The tier
      rules never depended on a rate, and a visitor seeing the billed currency
      is a worse experience, not a broken one.
    */
    storedRate.mockRejectedValue(new Error("database unreachable"));

    const res = await ask("US");
    const view = await res.json();

    expect(res.status).toBe(200);
    expect(view.currency).toBe("INR");
    expect(view.tiers.length).toBeGreaterThan(0);
  });
});
