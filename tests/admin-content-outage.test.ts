import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * The dashboard opens during a storage outage.
 *
 * The blob store passed its limit and began answering 403. This route was then
 * the single 500 on the dashboard — and because every tab sits behind one load,
 * the practitioner could not reach the blog, the clients or the sessions
 * either, all of which were working the whole time.
 *
 * Blob is gone and Postgres is the store now, so that is what is failed here.
 * The lesson outlived the store it was learned on.
 *
 * Refusing to open was the safe half of the answer and only the safe half. A
 * tool that locks its owner out during an outage is not protecting them. So it
 * opens on the shipped copy and says so, and the protection moves to the save.
 */
afterEach(() => {
  vi.doUnmock("@/lib/admin-guard");
  vi.doUnmock("@/lib/db");
  vi.resetModules();
});

function mockAdmin() {
  vi.doMock("@/lib/admin-guard", () => ({ requireAdmin: async () => null }));
}

/** A database that refuses every statement, as an unreachable one does. */
function mockStoreDown() {
  vi.doMock("@/lib/db", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/db")>()),
    dbConfigured: () => true,
    sql: () => {
      throw new Error("database unreachable");
    },
  }));
}

describe("GET /api/admin/content while storage is unavailable", () => {
  it("opens on the shipped copy instead of returning 500", async () => {
    vi.resetModules();
    mockAdmin();
    mockStoreDown();

    const { GET } = await import("@/app/api/admin/content/route");
    const { defaultContent } = await import("@/lib/content");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hero.headline).toBe(defaultContent.hero.headline);
  });

  it("says the body is not what is stored", async () => {
    // The flag is the whole reason opening is safe: a save replaces the stored
    // copy wholesale, and without this the dashboard cannot tell the difference.
    vi.resetModules();
    mockAdmin();
    mockStoreDown();

    const { GET } = await import("@/app/api/admin/content/route");
    expect((await GET()).headers.get("X-Content-Stored")).toBe("false");
  });

  it("keeps the editable tokens, so a save cannot bake today's price in", async () => {
    /*
      The dashboard must see {{rate.range}} rather than a resolved figure.
      Serving resolved copy here would replace the token with a number the first
      time anyone saved, quietly undoing the arrangement that keeps a rate in
      one place.
    */
    vi.resetModules();
    mockAdmin();
    mockStoreDown();

    const { GET } = await import("@/app/api/admin/content/route");
    const body = await (await GET()).json();
    expect(JSON.stringify(body)).toContain("{{rate.");
  });

  it("marks a normal read as stored", async () => {
    vi.resetModules();
    mockAdmin();
    vi.doMock("@/lib/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/db")>()),
      dbConfigured: () => true,
      sql: () => async () => [{ content: { hero: { headline: "Saved copy" } } }],
    }));

    const { GET } = await import("@/app/api/admin/content/route");
    const res = await GET();

    expect(res.headers.get("X-Content-Stored")).toBe("true");
    expect((await res.json()).hero.headline).toBe("Saved copy");
  });

  it("still refuses anyone who is not an administrator", async () => {
    // The fallback must not become a way to read content without signing in.
    vi.resetModules();
    vi.doMock("@/lib/admin-guard", () => ({
      requireAdmin: async () =>
        new Response("no", { status: 401 }),
    }));
    mockStoreDown();

    const { GET } = await import("@/app/api/admin/content/route");
    expect((await GET()).status).toBe(401);
  });
});
