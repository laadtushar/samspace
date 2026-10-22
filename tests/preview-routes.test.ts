import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Who sees a draft, and what the response says about it.
 *
 * Drafts must answer exactly like a page that does not exist to anyone who is
 * not signed in and holds no working link — the status, and the <title> as
 * well, since a draft's title in a not-found page is still a leak. And every
 * preview must carry the headers that keep it out of search engines, caches
 * and other sites' referrer logs.
 *
 * The routes themselves are a few lines each — look the draft up, 404 on null,
 * render — so the deciding is done in lib/preview.ts and lib/pages.ts, and that
 * is what runs here. The route files are read as source to pin that they wire
 * it up that way. (They are .tsx, which this test runner does not compile.)
 *
 * The database is a small in-memory stand-in that answers the handful of
 * queries these paths make; tests/pages-store.test.ts covers the same paths
 * against a real Postgres.
 */

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

let admin: unknown = null;
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  currentAdmin: async () => admin,
}));

vi.mock("next/cache", () => ({
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

type Row = Record<string, unknown>;
let pageRows: Row[] = [];
let postRows: Row[] = [];
let linkRows: Row[] = [];
const queries = vi.fn();

vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  dbConfigured: () => true,
  sql: () => {
    const query = async (text: string, params: unknown[] = []) => {
      queries(text);
      const [first] = params;
      if (/from pages/.test(text)) {
        if (/lower\(slug\)/.test(text)) {
          return pageRows.filter((r) => String(r.slug).toLowerCase() === String(first).toLowerCase());
        }
        if (/where id = /.test(text)) return pageRows.filter((r) => r.id === first);
        return pageRows;
      }
      if (/from blog_posts/.test(text)) {
        if (/lower\(slug\)/.test(text)) {
          return postRows.filter((r) => String(r.slug).toLowerCase() === String(first).toLowerCase());
        }
        return postRows;
      }
      if (/from preview_links/.test(text)) return linkRows.filter((r) => r.id === first);
      return [];
    };
    const tagged = async () => [];
    tagged.query = query;
    return tagged as never;
  },
}));

const { hashPreviewToken, generatePreviewToken, previewKey } = await import("@/lib/preview-links");
const preview = await import("@/lib/preview");
const pages = await import("@/lib/pages");
const { PREVIEW_METADATA } = preview;

const LINK_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const NOW = Date.now();
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const DAY = 24 * 60 * 60 * 1000;

const draftPage = {
  id: "page-1",
  slug: "a-draft-page",
  title: "Secret draft heading",
  content: "Draft body",
  status: "draft",
  seo_title: "Secret draft search title",
  seo_description: "",
  published_at: null,
  created_at: iso(-DAY),
  updated_at: iso(-DAY),
};

const draftPost = {
  id: "post-1",
  slug: "a-draft-post",
  title: "Secret draft post",
  excerpt: "",
  content: "Draft post body",
  cover_image: "",
  cover_alt: "",
  tags: [],
  status: "draft",
  published_at: null,
  updated_at: iso(-DAY),
  seo_title: "",
  seo_description: "",
};

const titleOf = (m: { title?: unknown }) => JSON.stringify(m.title ?? "");

beforeEach(() => {
  admin = null;
  pageRows = [draftPage];
  postRows = [draftPost];
  linkRows = [];
  queries.mockReset();
});

describe("signed-in previews", () => {
  it("finds nothing for a visitor, for a draft page or a draft post", async () => {
    expect(await preview.adminPreview("page", "a-draft-page")).toBeNull();
    expect(await preview.adminPreview("post", "a-draft-post")).toBeNull();
    // Not even asked: the session is checked before the database.
    expect(queries.mock.calls.some(([t]) => /from (pages|blog_posts)/.test(t))).toBe(false);
  });

  it("does not name the draft in a visitor's metadata", async () => {
    const meta = await preview.adminPreviewMetadata("page", "a-draft-page");
    expect(titleOf(meta)).not.toContain("Secret");
    expect(meta.robots).toEqual(PREVIEW_METADATA.robots);
    expect(titleOf(await preview.adminPreviewMetadata("post", "a-draft-post"))).not.toContain("Secret");
  });

  it("answers a draft and a slug nobody used identically", async () => {
    expect(await preview.adminPreviewMetadata("page", "a-draft-page")).toEqual(
      await preview.adminPreviewMetadata("page", "never-written")
    );
  });

  it("shows an admin the draft page under its search title", async () => {
    admin = { name: "Priyanka", role: "owner" };
    const target = await preview.adminPreview("page", "a-draft-page");
    expect(target?.kind === "page" && target.page.title).toBe("Secret draft heading");
    const meta = await preview.adminPreviewMetadata("page", "a-draft-page");
    expect(titleOf(meta)).toContain("Secret draft search title");
    expect(meta.robots).toEqual(PREVIEW_METADATA.robots);
  });

  it("shows an admin the draft post", async () => {
    admin = { name: "Priyanka", role: "owner" };
    const target = await preview.adminPreview("post", "a-draft-post");
    expect(target?.kind === "post" && target.post.title).toBe("Secret draft post");
  });

  it("still finds nothing for an admin when nothing is there", async () => {
    admin = { name: "Priyanka", role: "owner" };
    expect(await preview.adminPreview("post", "nope")).toBeNull();
  });

  it("is wired so that nothing found is a 404, with the admin banner otherwise", () => {
    for (const [route, kind] of [
      ["app/preview/page/[slug]/page.tsx", "page"],
      ["app/preview/blog/[slug]/page.tsx", "post"],
    ]) {
      const source = read(route);
      expect(source, route).toContain(`adminPreview("${kind}", params.slug)`);
      expect(source, route).toContain("if (!target) notFound();");
      expect(source, route).toContain(`adminPreviewMetadata("${kind}", params.slug)`);
      expect(source, route).toContain('mode="admin"');
    }
    const banner = read("components/PreviewBanner.tsx");
    expect(banner).toContain("Draft — only admins can see this");
    expect(banner).toContain("Preview — not published");
  });
});

describe("the public address of a page", () => {
  it("finds nothing for a draft, whoever is asking", async () => {
    // The live route never looks at the cookie; admins preview under /preview.
    admin = { name: "Priyanka", role: "owner" };
    expect(await pages.getPublishedPageBySlug("a-draft-page")).toBeNull();
  });

  it("finds the page once it is published", async () => {
    pageRows = [{ ...draftPage, status: "published", published_at: iso(-DAY) }];
    expect((await pages.getPublishedPageBySlug("a-draft-page"))?.title).toBe("Secret draft heading");
  });

  it("never serves a reserved or malformed slug, and does not ask the database", async () => {
    pageRows = [{ ...draftPage, slug: "admin", status: "published" }];
    expect(await pages.getPublishedPageBySlug("admin")).toBeNull();
    expect(await pages.getPublishedPageBySlug("../admin")).toBeNull();
    expect(queries.mock.calls.some(([text]) => /from pages/.test(text))).toBe(false);
  });

  it("asks only for published rows when listing them", async () => {
    await pages.getPublishedPages();
    expect(queries.mock.calls.some(([text]) => /status = 'published'/.test(text))).toBe(true);
  });

  it("is wired to the published-only lookup, never to the any-status one", () => {
    const source = read("app/[slug]/page.tsx");
    expect(source).toContain("getPublishedPageBySlug(params.slug)");
    expect(source).toContain("if (!stored) notFound();");
    expect(source).not.toMatch(/getPageBySlug|getPageById|currentAdmin|cookies\(/);
  });
});

describe("shared links", () => {
  const token = generatePreviewToken();
  const id = LINK_ID;
  const link = (over: Row = {}) => ({
    id,
    token_hash: hashPreviewToken(token),
    target_kind: "page",
    target_id: "page-1",
    created_at: iso(-DAY),
    expires_at: iso(13 * DAY),
    revoked_at: null,
    created_by: "Priyanka",
    ...over,
  });
  const key = previewKey(id, token);

  it("opens the draft for anyone holding a working link", async () => {
    linkRows = [link()];
    const found = await preview.linkPreview(key);
    expect(found?.target.kind).toBe("page");
    expect(found?.link.expiresAt).toBe(link().expires_at);
    const meta = await preview.linkPreviewMetadata(key);
    expect(titleOf(meta)).toContain("Secret draft search title");
    expect(meta.robots).toEqual(PREVIEW_METADATA.robots);
  });

  it("opens a post the same way", async () => {
    linkRows = [link({ target_kind: "post", target_id: "post-1" })];
    expect((await preview.linkPreview(key))?.target.kind).toBe("post");
  });

  it.each([
    ["expired", { expires_at: iso(-1000) }],
    ["revoked", { revoked_at: iso(-1000) }],
    ["for a deleted draft", { target_id: "gone" }],
  ])("finds nothing when the link is %s, and says nothing about the draft", async (_label, over) => {
    linkRows = [link(over)];
    expect(await preview.linkPreview(key)).toBeNull();
    expect(titleOf(await preview.linkPreviewMetadata(key))).not.toContain("Secret");
  });

  it("finds nothing for a wrong token on a real link", async () => {
    linkRows = [link()];
    expect(await preview.linkPreview(previewKey(id, generatePreviewToken()))).toBeNull();
  });

  it("finds nothing for junk, without asking the database", async () => {
    for (const junk of ["", "junk", `${id}.short`, "../../admin"]) {
      expect(await preview.linkPreview(junk), junk).toBeNull();
    }
    expect(queries).not.toHaveBeenCalled();
  });

  it("is wired so that nothing found is a 404, with the link banner otherwise", () => {
    const source = read("app/preview/link/[key]/page.tsx");
    expect(source).toContain("linkPreview(params.key)");
    expect(source).toContain("if (!found) notFound();");
    expect(source).toContain("linkPreviewMetadata(params.key)");
    expect(source).toContain('mode="link"');
  });
});

describe("previews are never indexed, cached or leaked by referrer", () => {
  it("sends noindex, no-store and no-referrer for everything under /preview", async () => {
    const { default: config } = await import("../next.config.mjs");
    const rules = await config.headers!();
    const rule = rules.find((r) => r.source === "/preview/:path*")!;
    const value = (key: string) => rule.headers.find((h) => h.key === key)?.value;

    expect(value("X-Robots-Tag")).toMatch(/noindex/);
    expect(value("X-Robots-Tag")).toMatch(/nofollow/);
    expect(value("Cache-Control")).toBe("private, no-store");
    expect(value("Referrer-Policy")).toBe("no-referrer");

    // Next applies matching entries in order and the last value for a key
    // wins, so the preview rule must come after the site-wide referrer policy.
    const global = rules.findIndex(
      (r) => r.source === "/:path*" && r.headers.some((h) => h.key === "Referrer-Policy")
    );
    expect(global).toBeGreaterThanOrEqual(0);
    expect(rules.indexOf(rule)).toBeGreaterThan(global);
  });

  it("says the same in the page's own metadata", () => {
    expect(PREVIEW_METADATA.robots).toMatchObject({ index: false, follow: false });
    expect(PREVIEW_METADATA.referrer).toBe("no-referrer");
  });

  it("renders every preview route per request, never from a cache", () => {
    for (const route of [
      "app/preview/page/[slug]/page.tsx",
      "app/preview/blog/[slug]/page.tsx",
      "app/preview/link/[key]/page.tsx",
    ]) {
      expect(read(route), route).toContain('export const dynamic = "force-dynamic"');
    }
  });

  it("keeps preview pages out of product analytics, which would carry the token", async () => {
    const { keepEvent } = await import("@/lib/analytics");
    expect(
      keepEvent(
        { eventName: "auto_capture::page_view" },
        { pathname: `/preview/link/${previewKey(LINK_ID, generatePreviewToken())}`, privateSurfaceOpen: false }
      )
    ).toBe(false);
  });
});
