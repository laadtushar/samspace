import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";

/**
 * Pages and preview links against a real Postgres.
 *
 * The parts that cannot be checked by reading the code: the migrations, the
 * unique and check constraints, a rename that moves a row, a published filter
 * done in SQL, and a link table that must never hold a working token. Skipped
 * without TEST_DATABASE_URL so a fresh clone still passes, like the other
 * database suites.
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

// Outside a Next request there is no cache to read or bust; pass straight
// through so the sitemap and the feed read the database itself.
vi.mock("next/cache", () => ({
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

let admin: unknown = null;
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  currentAdmin: async () => admin,
}));

suite("pages and preview links in Postgres", () => {
  let pages: typeof import("@/lib/pages");
  let blog: typeof import("@/lib/blog");
  let links: typeof import("@/lib/preview-links");
  let preview: typeof import("@/lib/preview");
  let sql: typeof import("@/lib/db").sql;

  const page = (over: Record<string, unknown> = {}) =>
    ({
      slug: "a-page",
      title: "A page",
      content: "The body of the page.",
      status: "draft",
      seoTitle: "",
      seoDescription: "",
      ...over,
    }) as never;

  const post = (over: Record<string, unknown> = {}) =>
    ({
      slug: "a-post",
      title: "A post",
      excerpt: "",
      content: "The body of the post.",
      coverImage: "",
      coverAlt: "",
      tags: [],
      status: "draft",
      seoTitle: "",
      seoDescription: "",
      publishedAt: "",
      ...over,
    }) as never;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    pages = await import("@/lib/pages");
    blog = await import("@/lib/blog");
    links = await import("@/lib/preview-links");
    preview = await import("@/lib/preview");
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  beforeEach(async () => {
    admin = null;
    await sql()`delete from preview_links`;
    await sql()`delete from pages`;
    await sql()`delete from blog_posts`;
  });

  describe("the migrations", () => {
    it("apply, and apply again without complaint", async () => {
      const { migrate } = await import("../scripts/migrate.mjs");
      const second = await migrate(url!);
      expect(second.applied).toEqual([]);
      const applied = (await sql()`select name from _migrations`).map((r) => r.name);
      expect(applied).toContain("013_pages.sql");
      expect(applied).toContain("014_preview_links.sql");
    });

    it("refuses a status that is neither draft nor published", async () => {
      await expect(
        sql()`insert into pages (id, slug, title, content, status)
              values ('x', 'x', 'X', 'Body', 'live')`
      ).rejects.toThrow();
    });

    it("refuses two pages at one slug, whatever the case", async () => {
      await pages.savePage(page({ slug: "taken" }));
      await expect(
        sql()`insert into pages (id, slug, title, content) values ('other', 'TAKEN', 'T', 'B')`
      ).rejects.toThrow();
    });
  });

  describe("pages", () => {
    it("round-trips every field", async () => {
      const saved = await pages.savePage(
        page({ slug: "round-trip", seoTitle: "S", seoDescription: "D", status: "published" })
      );
      const read = await pages.getPageBySlug("round-trip");
      expect(read).toEqual(saved);
      expect(read!.publishedAt).not.toBe("");
      expect(await pages.getPageById(saved.id)).toEqual(saved);
    });

    it("keeps a draft's publishedAt empty and stamps it once on publishing", async () => {
      const draft = await pages.savePage(page({ slug: "stamped" }));
      expect(draft.publishedAt).toBe("");
      const live = await pages.savePage(page({ slug: "stamped", status: "published" }));
      await new Promise((r) => setTimeout(r, 10));
      const edited = await pages.savePage(page({ slug: "stamped", status: "published", title: "Edited" }));
      expect(edited.publishedAt).toBe(live.publishedAt);
      expect(edited.updatedAt).not.toBe(live.updatedAt);
      expect(edited.createdAt).toBe(draft.createdAt);
    });

    it("moves the row on a rename", async () => {
      const before = await pages.savePage(page({ slug: "old" }));
      const after = await pages.savePage({ ...(page({ slug: "new" }) as object), previousSlug: "old" } as never);
      expect(after.id).toBe(before.id);
      expect(await pages.getPageBySlug("old")).toBeNull();
      expect(await pages.getAllPages()).toHaveLength(1);
    });

    it("serves only published pages publicly, and never one under a reserved name", async () => {
      await pages.savePage(page({ slug: "draft-one" }));
      await pages.savePage(page({ slug: "live-one", status: "published" }));
      // A row written by hand under a reserved name, past the API's checks.
      await sql()`insert into pages (id, slug, title, content, status)
                  values ('hand', 'admin', 'Hand-made', 'Body', 'published')`;

      expect(await pages.getPublishedPageBySlug("draft-one")).toBeNull();
      expect((await pages.getPublishedPageBySlug("live-one"))?.slug).toBe("live-one");
      expect(await pages.getPublishedPageBySlug("admin")).toBeNull();
      expect((await pages.getPublishedPages()).map((p) => p.slug)).toEqual(["live-one"]);
    });
  });

  describe("drafts stay out of the sitemap and the feed", () => {
    it("lists published pages and posts only", async () => {
      await pages.savePage(page({ slug: "draft-page" }));
      await pages.savePage(page({ slug: "live-page", status: "published" }));
      await blog.savePost(post({ slug: "draft-post" }));
      await blog.savePost(post({ slug: "live-post", status: "published" }));
      const draft = await pages.getPageBySlug("draft-page");
      await links.createPreviewLink({ kind: "page", targetId: draft!.id, createdBy: "T" });

      const { default: sitemap } = await import("@/app/sitemap");
      const urls = (await sitemap()).map((e) => e.url);
      expect(urls.some((u) => u.endsWith("/live-page"))).toBe(true);
      expect(urls.some((u) => u.endsWith("/blog/live-post"))).toBe(true);
      for (const u of urls) {
        expect(u).not.toMatch(/draft-page|draft-post|\/preview/);
      }

      const { GET } = await import("@/app/blog/rss.xml/route");
      const feed = await (await GET()).text();
      expect(feed).toContain("/blog/live-post");
      expect(feed).not.toMatch(/draft-post|draft-page|live-page|\/preview/);
    });

    it("dates a page in the sitemap by its own last save", async () => {
      const saved = await pages.savePage(page({ slug: "dated", status: "published" }));
      const { default: sitemap } = await import("@/app/sitemap");
      const entry = (await sitemap()).find((e) => e.url.endsWith("/dated"));
      expect(entry?.lastModified).toEqual(new Date(saved.updatedAt));
    });
  });

  describe("signed-in previews", () => {
    it("finds a draft for an admin and nothing for anyone else", async () => {
      await pages.savePage(page({ slug: "a-draft" }));
      await blog.savePost(post({ slug: "a-draft-post" }));

      expect(await preview.adminPreview("page", "a-draft")).toBeNull();
      expect(await preview.adminPreview("post", "a-draft-post")).toBeNull();

      admin = { name: "Priyanka", role: "owner" };
      expect((await preview.adminPreview("page", "a-draft"))?.kind).toBe("page");
      expect((await preview.adminPreview("post", "a-draft-post"))?.kind).toBe("post");
    });
  });

  describe("preview links", () => {
    async function draftPageId() {
      return (await pages.savePage(page({ slug: "shared-draft" }))).id;
    }

    it("stores a hash of the token and never the token", async () => {
      const id = await draftPageId();
      const { link, token, path } = await links.createPreviewLink({
        kind: "page",
        targetId: id,
        createdBy: "Priyanka",
      });
      expect(path).toBe(`/preview/link/${link.id}.${token}`);
      const [row] = await sql()`select * from preview_links where id = ${link.id}`;
      expect(row.token_hash).toBe(createHash("sha256").update(token).digest("hex"));
      for (const value of Object.values(row)) {
        expect(String(value)).not.toContain(token);
      }
    });

    it("expires fourteen days after it is made, by default", async () => {
      const id = await draftPageId();
      const now = new Date("2026-10-22T12:00:00Z");
      const { link } = await links.createPreviewLink({ kind: "page", targetId: id, createdBy: "", now });
      expect(new Date(link.expiresAt).getTime() - now.getTime()).toBe(
        links.PREVIEW_LINK_TTL_DAYS * 24 * 60 * 60 * 1000
      );
    });

    it("opens the draft while it works", async () => {
      const id = await draftPageId();
      const { link, token } = await links.createPreviewLink({ kind: "page", targetId: id, createdBy: "" });
      const found = await preview.linkPreview(links.previewKey(link.id, token));
      expect(found?.target.kind === "page" && found.target.page.slug).toBe("shared-draft");
    });

    it("keeps working after the draft is renamed", async () => {
      const id = await draftPageId();
      const { link, token } = await links.createPreviewLink({ kind: "page", targetId: id, createdBy: "" });
      await pages.savePage({ ...(page({ slug: "renamed" }) as object), previousSlug: "shared-draft" } as never);
      const found = await preview.linkPreview(links.previewKey(link.id, token));
      expect(found?.target.kind === "page" && found.target.page.slug).toBe("renamed");
    });

    it("stops once it has expired", async () => {
      const id = await draftPageId();
      const made = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const { link, token } = await links.createPreviewLink({
        kind: "page",
        targetId: id,
        createdBy: "",
        days: 1,
        now: made,
      });
      expect(await links.resolvePreviewKey(links.previewKey(link.id, token))).toBeNull();
      expect((await links.listPreviewLinks("page", id))[0].id).toBe(link.id);
    });

    it("stops the moment it is revoked, and revoking twice changes nothing", async () => {
      const id = await draftPageId();
      const { link, token } = await links.createPreviewLink({ kind: "page", targetId: id, createdBy: "" });
      const key = links.previewKey(link.id, token);
      expect(await links.resolvePreviewKey(key)).not.toBeNull();

      expect(await links.revokePreviewLink(link.id)).toBe(true);
      expect(await links.resolvePreviewKey(key)).toBeNull();
      const [first] = await links.listPreviewLinks("page", id);
      expect(first.revokedAt).not.toBe("");

      expect(await links.revokePreviewLink(link.id)).toBe(false);
      const [again] = await links.listPreviewLinks("page", id);
      expect(again.revokedAt).toBe(first.revokedAt);
    });

    it("refuses a wrong token on a real link id", async () => {
      const id = await draftPageId();
      const { link } = await links.createPreviewLink({ kind: "page", targetId: id, createdBy: "" });
      const guess = links.previewKey(link.id, links.generatePreviewToken());
      expect(await links.resolvePreviewKey(guess)).toBeNull();
    });

    it("opens a draft post too, and stops when the post is deleted", async () => {
      const saved = await blog.savePost(post({ slug: "post-to-share" }));
      const { link, token } = await links.createPreviewLink({ kind: "post", targetId: saved.id, createdBy: "" });
      const key = links.previewKey(link.id, token);
      expect((await preview.linkPreview(key))?.target.kind).toBe("post");
      await blog.deletePost("post-to-share");
      expect(await preview.linkPreview(key)).toBeNull();
    });

    it("goes with its page when the page is deleted", async () => {
      const id = await draftPageId();
      await links.createPreviewLink({ kind: "page", targetId: id, createdBy: "" });
      await pages.deletePage("shared-draft");
      expect(await links.listPreviewLinks("page", id)).toEqual([]);
    });
  });
});
