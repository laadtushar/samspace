import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Every public consumer reads content through the one accessor.
 *
 * Four of them used to hand-roll it: `getCachedContent().catch(...)` with their
 * own fallback. Two problems followed from that, and both were live.
 *
 * A bare catch swallows Next's DYNAMIC_SERVER_USAGE along with real failures,
 * which is what prerendered the shipped defaults into the deployment and froze
 * them there. Fixing `publicContent` fixed one of five call sites.
 *
 * And a hand-rolled fallback drifts. /whatsapp fell back to null and forwarded
 * to a page anchor, so when storage began refusing it sent people to #contact
 * although the handle was sitting in the defaults the rest of the site used.
 */
const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const PUBLIC_ROUTES = [
  "app/layout.tsx",
  "app/not-found.tsx",
  "app/page.tsx",
  "app/start/page.tsx",
  "app/blog/page.tsx",
  "app/blog/[slug]/page.tsx",
  "app/blog/rss.xml/route.ts",
  "app/whatsapp/route.ts",
  "app/api/pricing/route.ts",
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("public routes go through publicContent", () => {
  it.each(PUBLIC_ROUTES)("%s does not catch the read itself", (path) => {
    /*
      Read as source rather than executed: the thing being asserted is that no
      route grows its own catch around the content read, and a behavioural test
      can only cover the routes someone remembered to write one for.

      The admin routes are deliberately absent from this list — the dashboard
      must see the error rather than defaults it could save over real content.
    */
    const source = read(path);
    expect(source).not.toMatch(/getCachedContent\(\)\s*\.catch/);
    expect(source).not.toMatch(/getContent\(\)\s*\.catch/);
  });

  it("every one of them actually reads content through the accessor", () => {
    // Guarding the guard: a route that stopped reading content at all would
    // pass the assertion above by doing nothing.
    for (const path of PUBLIC_ROUTES) {
      expect(read(path)).toContain("publicContent");
    }
  });
});

describe("the WhatsApp redirect stands on the shipped floor", () => {
  it("forwards to the shipped handle when storage cannot be read", async () => {
    vi.resetModules();
    vi.doMock("next/cache", async (importOriginal) => ({
      ...(await importOriginal<typeof import("next/cache")>()),
      unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
    }));
    vi.doMock("@/lib/blob", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/blob")>()),
      readPublicJson: () => {
        throw new Error("Blob fetch failed for site-content.json: 403");
      },
    }));

    const { GET } = await import("@/app/whatsapp/route");
    const { defaultContent } = await import("@/lib/content");
    const res = await GET();

    expect(res.status).toBe(302);
    // The behaviour this exists for: a handle, not the contact anchor.
    expect(res.headers.get("location")).toBe(
      defaultContent.contact.whatsappLink
    );
    expect(res.headers.get("location")).not.toContain("#contact");
  });
});
