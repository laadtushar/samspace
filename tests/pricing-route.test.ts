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

vi.mock("@/lib/content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content")>();
  return { ...actual, getCachedContent: () => siteContent() };
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
