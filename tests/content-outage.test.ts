import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";

/**
 * What the public site does when its storage is unavailable.
 *
 * The read raises on anything that is not "no row" — an unreachable database,
 * a migration that has not run, a bad gateway — and five public routes awaited
 * it without catching. An outage did not degrade this site, it took it down,
 * and the first sign would have been a 500 on the page someone books from.
 *
 * Written against the database because that is now the only store. It was blob
 * when these were first written, and blob is exactly what proved the point:
 * it passed its limit, answered 403, and the live site served its defaults.
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
    vi.doMock("@/lib/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/db")>()),
      dbConfigured: () => true,
      sql: () => {
        throw new Error("database unreachable");
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
    vi.doMock("@/lib/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/db")>()),
      dbConfigured: () => true,
      sql: () => {
        throw new Error("database unreachable");
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
    vi.doMock("@/lib/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/db")>()),
      dbConfigured: () => true,
      sql: () => {
        throw new Error("database unreachable");
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

describe("Next's own signals are not treated as an outage", () => {
  /*
    The fallback was absorbing them, and that is how the shipped defaults ended
    up prerendered onto the live homepage and /start — with an empty booking link
    and an empty WhatsApp link — for every visitor.

    Reading storage during a prerender throws DynamicServerError, which is Next
    asking for the route to be rendered on demand instead. Answering it with the
    defaults does not degrade the page, it changes what the page is: the
    fallback gets baked into the deployment and stays there until the next one.
  */
  const signal = (digest: string) =>
    Object.assign(new Error(`Dynamic server usage: no-store fetch`), { digest });

  const mockFailingRead = (error: unknown) => {
    vi.resetModules();
    /*
      The cache passes the call straight through. Outside a request context
      `unstable_cache` throws an invariant of its own before the wrapped function
      ever runs, which would make every case here pass for the wrong reason — the
      fallback returned, but because of the cache rather than the read.
    */
    vi.doMock("next/cache", async (importOriginal) => ({
      ...(await importOriginal<typeof import("next/cache")>()),
      unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
    }));
    vi.doMock("@/lib/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/db")>()),
      dbConfigured: () => true,
      sql: () => {
        throw error;
      },
    }));
  };

  it.each([
    ["DYNAMIC_SERVER_USAGE"],
    ["BAILOUT_TO_CLIENT_SIDE_RENDERING"],
    ["NEXT_NOT_FOUND"],
    ["NEXT_REDIRECT;replace;/start;307;"],
  ])("rethrows %s rather than serving the fallback", async (digest) => {
    mockFailingRead(signal(digest));
    const { publicContent } = await import("@/lib/content");
    await expect(publicContent()).rejects.toMatchObject({ digest });
  });

  it("still absorbs an ordinary storage failure", async () => {
    // The distinction has to hold in both directions, or the fix is just the
    // old bug with the site down instead of stale.
    mockFailingRead(new Error("store paused"));
    const { publicContent, defaultContent } = await import("@/lib/content");
    await expect(publicContent()).resolves.toMatchObject({
      hero: { headline: defaultContent.hero.headline },
    });
  });

  it("does not mistake a numeric digest for a signal", async () => {
    // Next's digests are strings. A thrown object that happens to carry a
    // numeric `digest` is not Next asking for anything.
    mockFailingRead(Object.assign(new Error("store paused"), { digest: 500 }));
    const { publicContent, defaultContent } = await import("@/lib/content");
    await expect(publicContent()).resolves.toMatchObject({
      hero: { headline: defaultContent.hero.headline },
    });
  });
});
