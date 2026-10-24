import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The admin endpoints for pages and preview links: who may call them, and
 * what they refuse. The dashboard's own checks are a convenience; these are
 * reachable directly, so every rule that matters is asserted here.
 */

let admin: Response | null = null;
const identity = { name: "Priyanka", role: "owner" };
vi.mock("@/lib/admin-guard", () => ({
  requireAdmin: async () => admin,
  adminOrDenied: async () =>
    admin ? { identity: null, denied: admin } : { identity, denied: null },
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));
vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  dbConfigured: () => true,
}));

const savePage = vi.fn();
const existingSlugs = new Set<string>();
const pageIds = new Set<string>();
vi.mock("@/lib/pages", () => ({
  getAllPages: async () => [],
  getPageBySlug: async (slug: string) => (existingSlugs.has(slug) ? { slug } : null),
  getPageById: async (id: string) => (pageIds.has(id) ? { id } : null),
  savePage: (input: Record<string, unknown>) => savePage(input),
  deletePage: async () => undefined,
}));
vi.mock("@/lib/blog", () => ({
  getAllPosts: async () => [{ id: "post-1", slug: "a-post" }],
}));

const createPreviewLink = vi.fn();
const revokePreviewLink = vi.fn();
vi.mock("@/lib/preview-links", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/preview-links")>()),
  createPreviewLink: (o: unknown) => createPreviewLink(o),
  revokePreviewLink: (id: string) => revokePreviewLink(id),
  listPreviewLinks: async () => [],
}));

const pagesRoute = await import("@/app/api/admin/pages/route");
const previewsRoute = await import("@/app/api/admin/previews/route");
const { PREVIEW_LINK_TTL_DAYS } = await import("@/lib/preview-links");

const json = (url: string, method: string, body?: unknown) =>
  new Request(`https://example.test${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const page = (over: Record<string, unknown> = {}) => ({
  slug: "a-new-page",
  title: "A new page",
  content: "Body",
  status: "draft",
  seoTitle: "",
  seoDescription: "",
  ...over,
});

beforeEach(() => {
  admin = null;
  existingSlugs.clear();
  pageIds.clear();
  savePage.mockReset().mockImplementation(async (input) => ({ id: "p1", ...input }));
  createPreviewLink.mockReset();
  revokePreviewLink.mockReset();
});

describe("POST /api/admin/pages", () => {
  it("saves a valid page", async () => {
    const res = await pagesRoute.POST(json("/api/admin/pages", "POST", page()));
    expect(res.status).toBe(200);
    expect(savePage).toHaveBeenCalledTimes(1);
  });

  it("refuses anyone who is not signed in", async () => {
    admin = new Response("no", { status: 401 });
    expect((await pagesRoute.POST(json("/api/admin/pages", "POST", page()))).status).toBe(401);
    expect((await pagesRoute.GET()).status).toBe(401);
    expect(savePage).not.toHaveBeenCalled();
  });

  it.each(["admin", "api", "blog", "preview", "sitemap", "robots", "start"])(
    "refuses the reserved slug %s",
    async (slug) => {
      const res = await pagesRoute.POST(json("/api/admin/pages", "POST", page({ slug })));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/already a part of the site/);
      expect(savePage).not.toHaveBeenCalled();
    }
  );

  it.each(["Bad Slug", "a/b", "../x", "x.html", ""])("refuses the malformed slug %j", async (slug) => {
    const res = await pagesRoute.POST(json("/api/admin/pages", "POST", page({ slug })));
    expect(res.status).toBe(400);
    expect(savePage).not.toHaveBeenCalled();
  });

  it("refuses to publish a page that still has placeholders", async () => {
    const res = await pagesRoute.POST(
      json("/api/admin/pages", "POST", page({
        status: "published",
        content: "Fees **[To confirm: currency]**",
      }))
    );
    expect(res.status).toBe(400);
    expect(savePage).not.toHaveBeenCalled();
  });

  it("refuses a second page at a slug already in use", async () => {
    existingSlugs.add("taken");
    const res = await pagesRoute.POST(json("/api/admin/pages", "POST", page({ slug: "taken" })));
    expect(res.status).toBe(409);
  });
});

describe("/api/admin/previews", () => {
  it("refuses anyone who is not signed in, for every method", async () => {
    admin = new Response("no", { status: 401 });
    expect((await previewsRoute.GET(json("/api/admin/previews?kind=page&id=p1", "GET"))).status).toBe(401);
    expect((await previewsRoute.POST(json("/api/admin/previews", "POST", { kind: "page", id: "p1" }))).status).toBe(401);
    expect((await previewsRoute.DELETE(json("/api/admin/previews?id=x", "DELETE"))).status).toBe(401);
    expect(createPreviewLink).not.toHaveBeenCalled();
    expect(revokePreviewLink).not.toHaveBeenCalled();
  });

  it("makes a link for a page that exists, recording who made it", async () => {
    pageIds.add("p1");
    createPreviewLink.mockResolvedValue({
      link: { id: "l1", expiresAt: "2026-11-05T00:00:00Z", revokedAt: "" },
      token: "t",
      path: "/preview/link/l1.t",
    });
    const res = await previewsRoute.POST(json("/api/admin/previews", "POST", { kind: "page", id: "p1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).path).toBe("/preview/link/l1.t");
    expect(createPreviewLink).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "page", targetId: "p1", createdBy: "Priyanka" })
    );
  });

  it("makes a link for a post that exists", async () => {
    createPreviewLink.mockResolvedValue({ link: { id: "l2", expiresAt: "2026-11-05T00:00:00Z", revokedAt: "" }, token: "t", path: "/p" });
    const res = await previewsRoute.POST(json("/api/admin/previews", "POST", { kind: "post", id: "post-1" }));
    expect(res.status).toBe(200);
  });

  it("refuses a link to something that does not exist", async () => {
    const res = await previewsRoute.POST(json("/api/admin/previews", "POST", { kind: "page", id: "missing" }));
    expect(res.status).toBe(404);
    expect(createPreviewLink).not.toHaveBeenCalled();
  });

  it("refuses an unknown kind or an out-of-range lifetime", async () => {
    pageIds.add("p1");
    for (const body of [
      { kind: "user", id: "p1" },
      { kind: "page", id: "p1", expiresInDays: 0 },
      { kind: "page", id: "p1", expiresInDays: 10_000 },
    ]) {
      const res = await previewsRoute.POST(json("/api/admin/previews", "POST", body));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(createPreviewLink).not.toHaveBeenCalled();
  });

  it("tells the dashboard the default lifetime rather than letting it guess", async () => {
    const res = await previewsRoute.GET(json("/api/admin/previews?kind=page&id=p1", "GET"));
    expect((await res.json()).defaultDays).toBe(PREVIEW_LINK_TTL_DAYS);
  });

  it("revokes a working link, and says so when there was none", async () => {
    revokePreviewLink.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await previewsRoute.DELETE(json("/api/admin/previews?id=l1", "DELETE"))).status).toBe(200);
    expect((await previewsRoute.DELETE(json("/api/admin/previews?id=l1", "DELETE"))).status).toBe(404);
  });
});
