import { describe, it, expect, beforeAll, beforeEach } from "vitest";

/**
 * Blog storage against a real Postgres.
 *
 * The move off blob is mostly SQL — an upsert, a unique index, a rename that
 * must move a row rather than duplicate it — and none of that can be verified
 * by reading the code. Skipped without TEST_DATABASE_URL so a fresh clone still
 * passes; CI sets it, and tests/practice.test.ts fails the build if it is
 * missing there.
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("blog posts in Postgres", () => {
  let blog: typeof import("@/lib/blog");
  let sql: typeof import("@/lib/db").sql;

  const input = (over: Record<string, unknown> = {}) =>
    ({
      slug: "a-post",
      title: "A post",
      excerpt: "",
      content: "The body of the post, long enough to derive an excerpt from.",
      coverImage: "",
      coverAlt: "",
      tags: ["Anxiety", "Young adults"],
      status: "draft",
      seoTitle: "",
      seoDescription: "",
      publishedAt: "",
      ...over,
    }) as never;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    blog = await import("@/lib/blog");
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  beforeEach(async () => {
    await sql()`delete from blog_posts`;
  });

  it("round-trips every field, including the ones with defaults", async () => {
    const saved = await blog.savePost(
      input({
        slug: "round-trip",
        title: "Round trip",
        excerpt: "Written, not derived.",
        coverImage: "/blog/cover.svg",
        coverAlt: "A cover",
        tags: ["One", "Two"],
        status: "published",
        seoTitle: "SEO title",
        seoDescription: "SEO description",
      })
    );
    const read = await blog.getPostBySlug("round-trip");
    expect(read).toEqual(saved);
    expect(read!.tags).toEqual(["One", "Two"]);
    expect(read!.publishedAt).not.toBe("");
  });

  it("keeps an unpublished post's publishedAt empty, not epoch", async () => {
    // The column is null and the application says "". A naive mapping turns
    // null into 1970, which would sort a draft to the bottom of the archive
    // and put a wrong date in the structured data if it were ever published.
    await blog.savePost(input({ slug: "still-a-draft" }));
    const read = await blog.getPostBySlug("still-a-draft");
    expect(read!.publishedAt).toBe("");
    expect(read!.status).toBe("draft");
  });

  it("stamps publishedAt once and does not move it on later edits", async () => {
    const first = await blog.savePost(
      input({ slug: "stamped", status: "published" })
    );
    await new Promise((r) => setTimeout(r, 10));
    const second = await blog.savePost(
      input({ slug: "stamped", status: "published", title: "Edited" })
    );
    expect(second.publishedAt).toBe(first.publishedAt);
    expect(second.updatedAt).not.toBe(first.updatedAt);
  });

  it("moves the row on a rename rather than leaving a copy behind", async () => {
    const before = await blog.savePost(input({ slug: "old-slug" }));
    const after = await blog.savePost(
      input({ slug: "new-slug", previousSlug: "old-slug" }) as never
    );
    expect(after.id).toBe(before.id);
    expect(await blog.getPostBySlug("old-slug")).toBeNull();
    expect((await blog.getPostBySlug("new-slug"))!.id).toBe(before.id);
    const all = await blog.getAllPosts();
    expect(all).toHaveLength(1);
  });

  it("refuses two posts sharing a slug", async () => {
    await blog.savePost(input({ slug: "taken" }));
    await expect(
      sql()`insert into blog_posts (id, slug, title, content)
            values ('other-id', 'TAKEN', 'Clash', 'Body')`
    ).rejects.toThrow();
  });

  it("returns published posts newest first, drafts excluded", async () => {
    await blog.savePost(
      input({ slug: "older", status: "published", publishedAt: "2026-01-01T00:00:00.000Z" })
    );
    await blog.savePost(
      input({ slug: "newer", status: "published", publishedAt: "2026-06-01T00:00:00.000Z" })
    );
    await blog.savePost(input({ slug: "hidden", status: "draft" }));

    const published = await blog.getPublishedPosts();
    expect(published.map((p) => p.slug)).toEqual(["newer", "older"]);
    expect(await blog.getPublishedPostBySlug("hidden")).toBeNull();
  });

  it("deletes", async () => {
    await blog.savePost(input({ slug: "temporary" }));
    await blog.deletePost("temporary");
    expect(await blog.getPostBySlug("temporary")).toBeNull();
    expect(await blog.getAllPosts()).toHaveLength(0);
  });

  it("counts tags across published posts only", async () => {
    await blog.savePost(
      input({ slug: "one", status: "published", tags: ["Anxiety", "Sleep"] })
    );
    await blog.savePost(
      input({ slug: "two", status: "published", tags: ["Anxiety"] })
    );
    await blog.savePost(input({ slug: "three", tags: ["Invisible"] }));

    const tags = await blog.getPublishedTags();
    expect(tags[0]).toBe("Anxiety");
    expect(tags).not.toContain("Invisible");
  });

  it("survives a row whose tags are not an array", async () => {
    // Nothing in the application writes this, but a hand-edited row should not
    // take the whole archive down with it.
    await sql()`insert into blog_posts (id, slug, title, content, tags, status)
                values ('odd', 'odd-row', 'Odd', 'Body', '"not-an-array"'::jsonb, 'published')`;
    const posts = await blog.getPublishedPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].tags).toEqual([]);
  });
});
