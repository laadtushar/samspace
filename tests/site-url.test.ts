import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

/**
 * The origin the site claims to be, and the switch that de-indexes it.
 *
 * `IS_PRODUCTION_SITE` decides whether robots.txt allows crawling at all, so a
 * hostname that fails to look like production takes the site out of Google.
 * www and the bare domain are the same site — Vercel serves one and redirects
 * the other — and both have to pass.
 *
 * SITE_URL is read once at import, so each case re-imports the module with the
 * environment it is testing. The suite shares a process, so the environment is
 * put back afterwards.
 */
const KEYS = ["NEXT_PUBLIC_SITE_URL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_BRANCH_URL"];
const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

const load = async (env: Record<string, string | undefined>) => {
  for (const key of KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }
  vi.resetModules();
  return import("@/lib/site");
};

beforeEach(() => {
  vi.resetModules();
});

afterAll(() => {
  for (const key of KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  vi.resetModules();
});

describe("the site's own origin", () => {
  it("defaults to the host that actually serves", async () => {
    // Vercel serves www and 308-redirects the bare domain to it, so canonical
    // URLs have to say www or they all point at a redirect.
    const { SITE_URL, IS_PRODUCTION_SITE } = await load({});
    expect(SITE_URL).toBe("https://www.samvritispace.com");
    expect(IS_PRODUCTION_SITE).toBe(true);
  });

  it("counts either form as the live site, so crawling stays allowed", async () => {
    for (const host of [
      "https://www.samvritispace.com",
      "https://samvritispace.com",
    ]) {
      const { SITE_URL, IS_PRODUCTION_SITE } = await load({
        NEXT_PUBLIC_SITE_URL: host,
      });
      expect(SITE_URL).toBe(host);
      expect(IS_PRODUCTION_SITE, host).toBe(true);
    }
  });

  it("drops a trailing slash from the override", async () => {
    const { SITE_URL } = await load({
      NEXT_PUBLIC_SITE_URL: "https://www.samvritispace.com/",
    });
    expect(SITE_URL).toBe("https://www.samvritispace.com");
  });

  it("does not treat a preview deployment as production", async () => {
    const { SITE_URL, IS_PRODUCTION_SITE } = await load({
      VERCEL_ENV: "preview",
      VERCEL_BRANCH_URL: "samspace-git-branch.vercel.app",
    });
    expect(SITE_URL).toBe("https://samspace-git-branch.vercel.app");
    expect(IS_PRODUCTION_SITE).toBe(false);
  });

  it("does not mistake a lookalike domain for the live site", async () => {
    for (const host of [
      "https://samvritispace.com.evil.test",
      "https://notsamvritispace.com",
      "https://samvritispace.net",
      "not a url",
    ]) {
      const { IS_PRODUCTION_SITE } = await load({ NEXT_PUBLIC_SITE_URL: host });
      expect(IS_PRODUCTION_SITE, host).toBe(false);
    }
  });

  it("builds absolute URLs against whatever origin is in force", async () => {
    const { absoluteUrl } = await load({
      NEXT_PUBLIC_SITE_URL: "https://www.samvritispace.com",
    });
    expect(absoluteUrl("/blog")).toBe("https://www.samvritispace.com/blog");
  });
});
