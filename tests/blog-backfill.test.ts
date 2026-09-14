import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

/**
 * The window between this deploying and the rows arriving.
 *
 * Without a backfill there is a state that loses posts: the table is empty,
 * blob is not, and the first edit writes one row — after which reads come from
 * the database, because it is no longer empty, and every other post disappears
 * from the live site. This covers the path that closes that window, because it
 * is the one whose failure is an outage rather than an inconvenience.
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const stored: Record<string, unknown>[] = [];

vi.mock("@/lib/blob", () => ({
  listBlobs: async () => stored.map((p) => ({ pathname: `blog/${p.slug}.json` })),
  readConfidentialJson: async (pathname: string) =>
    stored.find((p) => `blog/${p.slug}.json` === pathname) ?? null,
  writeConfidentialJson: async () => {},
  deleteBlob: async () => {},
  readPublicJson: async (_k: string, fallback: unknown) => fallback,
  writePublicJson: async () => {},
}));

const post = (slug: string, over: Record<string, unknown> = {}) => ({
  id: `id-${slug}`,
  slug,
  title: `Post ${slug}`,
  excerpt: "",
  content: "Body.",
  coverImage: "",
  coverAlt: "",
  tags: ["Anxiety"],
  status: "published",
  publishedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  seoTitle: "",
  seoDescription: "",
  ...over,
});

suite("moving posts out of blob", () => {
  let blog: typeof import("@/lib/blog");
  let sql: typeof import("@/lib/db").sql;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    blog = await import("@/lib/blog");
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  beforeEach(async () => {
    await sql()`delete from blog_posts`;
    stored.length = 0;
  });

  it("serves what is in blob while the table is still empty", async () => {
    stored.push(post("first"), post("second"));
    const posts = await blog.getAllPosts();
    expect(posts.map((p) => p.slug).sort()).toEqual(["first", "second"]);
  });

  it("copies them across on that first read", async () => {
    stored.push(post("first"), post("second"));
    await blog.getAllPosts();

    const rows = await sql()`select slug, id, tags, status from blog_posts order by slug`;
    expect(rows.map((r) => r.slug)).toEqual(["first", "second"]);
    // Identity is preserved, or a copied post is a different post.
    expect(rows.map((r) => r.id)).toEqual(["id-first", "id-second"]);
    expect(rows[0].tags).toEqual(["Anxiety"]);
  });

  it("stops reading blob once the rows are there", async () => {
    stored.push(post("first"));
    await blog.getAllPosts();

    // Blob now disagrees with the table. The table wins, which is what proves
    // it is no longer being consulted.
    stored.length = 0;
    stored.push(post("something-else"));
    const posts = await blog.getAllPosts();
    expect(posts.map((p) => p.slug)).toEqual(["first"]);
  });

  it("does not duplicate when two reads race", async () => {
    stored.push(post("first"), post("second"));
    await Promise.all([blog.getAllPosts(), blog.getAllPosts(), blog.getAllPosts()]);
    const rows = await sql()`select count(*)::int as n from blog_posts`;
    expect(rows[0].n).toBe(2);
  });

  it("closes the window an edit would otherwise open", async () => {
    /*
      The exact failure: with blob holding two posts and the table empty,
      saving an edit to one of them must not leave the other unreachable.
    */
    stored.push(post("first"), post("second"));
    await blog.savePost(post("first", { title: "Edited" }) as never);

    const posts = await blog.getAllPosts();
    expect(posts.map((p) => p.slug).sort()).toEqual(["first", "second"]);
  });

  it("finds a post by slug before the backfill has run", async () => {
    stored.push(post("only-in-blob"));
    const found = await blog.getPostBySlug("only-in-blob");
    expect(found?.slug).toBe("only-in-blob");
  });

  it("returns nothing rather than throwing when both are empty", async () => {
    expect(await blog.getAllPosts()).toEqual([]);
    expect(await blog.getPostBySlug("nothing")).toBeNull();
  });
});
