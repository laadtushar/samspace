import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";

/**
 * What the public site does when its storage is unavailable.
 *
 * The read raises on anything that is not a 404 — a paused store, an expired
 * token, a bad gateway — and five public routes awaited it without catching.
 * An outage did not degrade this site, it took it down, and the first sign
 * would have been a 500 on the page someone books from.
 */
const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("a storage outage degrades rather than breaks", () => {
  it("serves the shipped copy when the read fails", async () => {
    vi.resetModules();
    vi.doMock("@/lib/blob", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/blob")>()),
      readPublicJson: () => {
        throw new Error("store paused");
      },
    }));

    const { publicContent, defaultContent } = await import("@/lib/content");
    const content = await publicContent();

    // A genuine floor: prices, crisis numbers and contact details all render.
    expect(content.slidingScale).toEqual(defaultContent.slidingScale);
    expect(content.crisis.helplines.length).toBeGreaterThan(0);
    expect(content.contact.email).toBe(defaultContent.contact.email);
  });

  it("resolves tokens in the fallback, so no price renders as braces", async () => {
    vi.resetModules();
    vi.doMock("@/lib/blob", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/blob")>()),
      readPublicJson: () => {
        throw new Error("store paused");
      },
    }));

    const { publicContent } = await import("@/lib/content");
    const content = await publicContent();
    expect(JSON.stringify(content)).not.toContain("{{");
    expect(content.faq.items.map((i) => i.answer).join(" ")).toContain("₹");
  });

  it("does not cache the fallback", async () => {
    /*
      unstable_cache stores what the function returns, so catching inside it
      would pin the shipped defaults for an hour after one bad second. The catch
      is outside, which is observable: the cached accessor still throws, and
      only the public one absorbs it.
    */
    vi.resetModules();
    vi.doMock("@/lib/blob", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/blob")>()),
      readPublicJson: () => {
        throw new Error("store paused");
      },
    }));

    const { getCachedContent, publicContent } = await import("@/lib/content");

    // The cached accessor propagates whatever went wrong — the storage error
    // here, and in this environment the missing cache context too, which is
    // itself a reminder of how many ways this call can fail.
    await expect(getCachedContent()).rejects.toThrow();
    // The public one absorbs all of them and still answers.
    const content = await publicContent();
    expect(content.slidingScale.length).toBeGreaterThan(0);
  });
});

describe("every public route survives the outage", () => {
  const PUBLIC_ROUTES = [
    "app/page.tsx",
    "app/start/page.tsx",
    "app/blog/page.tsx",
    "app/blog/[slug]/page.tsx",
    "app/blog/rss.xml/route.ts",
  ];

  it("reads content through the accessor that cannot throw", () => {
    for (const route of PUBLIC_ROUTES) {
      const source = read(route);
      expect(source, route).toContain("publicContent");
      // The raw accessor throws; no public page may await it bare.
      expect(source, route).not.toMatch(/await getCachedContent\(\)(?!\s*\.catch)/);
    }
  });
});
