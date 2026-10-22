import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The sitemap's dates. lastmod is the one field Google reads, and only while
 * it tracks real edits, so these pin what moves it and what does not.
 */
const posts = vi.fn();
const copySaved = vi.fn();
const pages = vi.fn();

vi.mock("@/lib/blog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/blog")>()),
  getCachedPublishedPosts: () => posts(),
}));
vi.mock("@/lib/pages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pages")>()),
  getCachedPublishedPages: () => pages(),
}));
vi.mock("@/lib/content", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content")>()),
  contentUpdatedAt: () => copySaved(),
}));

const { default: sitemap } = await import("@/app/sitemap");
const { SITE_URL } = await import("@/lib/site");

const entry = (all: Awaited<ReturnType<typeof sitemap>>, path: string) =>
  all.find((e) => e.url === `${SITE_URL}${path}`)!;

describe("sitemap dates", () => {
  beforeEach(() => {
    pages.mockResolvedValue([]);
    posts.mockResolvedValue([
      { slug: "newest", updatedAt: "2026-10-21T19:54:39.183Z", publishedAt: "2026-10-21T19:54:39.183Z" },
      { slug: "older", updatedAt: "", publishedAt: "2026-08-01T00:00:00.000Z" },
    ]);
  });

  it("moves the homepage and author page when the dashboard copy is saved", async () => {
    copySaved.mockResolvedValue(new Date("2026-10-20T10:00:00Z"));
    const all = await sitemap();
    expect(entry(all, "").lastModified).toEqual(new Date("2026-10-20T10:00:00Z"));
    expect(entry(all, "/about").lastModified).toEqual(new Date("2026-10-20T10:00:00Z"));
  });

  it("keeps the shipped date when nothing newer was saved or the save time can't be read", async () => {
    for (const saved of [null, new Date("2026-01-01T00:00:00Z")]) {
      copySaved.mockResolvedValue(saved);
      const all = await sitemap();
      expect(entry(all, "").lastModified).toEqual(new Date("2026-09-14"));
    }
  });

  it("dates the blog by its newest post and each post by its own last edit", async () => {
    copySaved.mockResolvedValue(null);
    const all = await sitemap();
    expect(entry(all, "/blog").lastModified).toEqual(new Date("2026-10-21T19:54:39.183Z"));
    expect(entry(all, "/blog/older").lastModified).toEqual(new Date("2026-08-01T00:00:00.000Z"));
  });

  it("still lists every page when the post list can't be read", async () => {
    copySaved.mockResolvedValue(null);
    posts.mockRejectedValue(new Error("db down"));
    const all = await sitemap();
    expect(all.map((e) => e.url)).toEqual([SITE_URL, `${SITE_URL}/about`, `${SITE_URL}/blog`]);
  });

  it("dates each published page by its own last edit", async () => {
    copySaved.mockResolvedValue(null);
    pages.mockResolvedValue([
      { slug: "therapy-for-indians-abroad", status: "published", updatedAt: "2026-10-22T08:00:00.000Z", publishedAt: "2026-10-01T00:00:00.000Z" },
    ]);
    const all = await sitemap();
    expect(entry(all, "/therapy-for-indians-abroad").lastModified).toEqual(
      new Date("2026-10-22T08:00:00.000Z")
    );
  });

  it("still lists every other page when the page list can't be read", async () => {
    copySaved.mockResolvedValue(null);
    pages.mockRejectedValue(new Error("db down"));
    const all = await sitemap();
    expect(all.map((e) => e.url)).toContain(`${SITE_URL}/blog/newest`);
  });

  it("never lists a preview URL", async () => {
    copySaved.mockResolvedValue(null);
    const all = await sitemap();
    expect(all.some((e) => e.url.includes("/preview"))).toBe(false);
  });
});
