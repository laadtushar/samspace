import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

/**
 * Updating a post to the shipped version, against a real Postgres.
 *
 * tests/blog-import.test.ts covers the route's decisions with storage mocked.
 * What only a real database can show is that the row is updated in place — the
 * same id, the publish date untouched — rather than a second row appearing or
 * the date being restamped. Skipped without TEST_DATABASE_URL, like the other
 * database suites.
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

vi.mock("@/lib/admin-guard", () => ({
  ownerOrDenied: async () => ({ identity: { role: "owner", name: "Owner" }, denied: null }),
}));
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: () => {},
}));

suite("updating a shipped post in Postgres", () => {
  let blog: typeof import("@/lib/blog");
  let sql: typeof import("@/lib/db").sql;
  let route: typeof import("@/app/api/admin/blog/import/route");
  let STARTER_POSTS: typeof import("@/lib/starter-posts").STARTER_POSTS;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    blog = await import("@/lib/blog");
    ({ sql } = await import("@/lib/db"));
    ({ STARTER_POSTS } = await import("@/lib/starter-posts"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
    route = await import("@/app/api/admin/blog/import/route");
  });

  beforeEach(async () => {
    await sql()`delete from blog_posts`;
  });

  const replace = (slugs: string[]) =>
    route.POST(
      new Request("http://localhost/api/admin/blog/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ replace: slugs }),
      })
    );

  it("rewrites the row in place, keeping its id, status, date and cover", async () => {
    const starter = STARTER_POSTS.find((p) => p.slug === "high-functioning-anxiety")!;
    const before = await blog.savePost({
      slug: starter.slug,
      title: "An older title",
      excerpt: "An older excerpt.",
      content: "Older text.",
      coverImage: "/media/chosen-in-the-dashboard.png",
      coverAlt: "Chosen in the dashboard",
      tags: ["Old"],
      status: "published",
      seoTitle: "Older SEO title",
      seoDescription: "Older SEO description.",
      publishedAt: "2026-01-15T09:30:00.000Z",
    });

    const res = await replace([starter.slug]);
    expect(res.status).toBe(200);

    const after = await blog.getPostBySlug(starter.slug);
    expect(after).not.toBeNull();
    expect(after!.id).toBe(before.id);
    expect(after!.status).toBe("published");
    expect(after!.publishedAt).toBe("2026-01-15T09:30:00.000Z");
    expect(after!.coverImage).toBe("/media/chosen-in-the-dashboard.png");
    expect(after!.coverAlt).toBe("Chosen in the dashboard");
    expect(after!.title).toBe(starter.title);
    expect(after!.excerpt).toBe(starter.excerpt);
    expect(after!.content).toBe(starter.content);
    expect(after!.tags).toEqual(starter.tags);
    expect(after!.seoTitle).toBe(starter.seoTitle);
    expect(after!.seoDescription).toBe(starter.seoDescription);

    const rows = await sql()`select count(*)::int as n from blog_posts`;
    expect(rows[0].n).toBe(1);

    const listed = await (await route.GET()).json();
    expect(listed.posts.find((p: { slug: string }) => p.slug === starter.slug).state).toBe(
      "identical"
    );
  });

  it("imports into an empty blog and then reports every post as identical", async () => {
    const res = await route.POST(
      new Request("http://localhost/api/admin/blog/import", { method: "POST" })
    );
    expect((await res.json()).imported).toHaveLength(STARTER_POSTS.length);

    const listed = await (await route.GET()).json();
    expect(listed.remaining).toBe(0);
    expect(listed.differing).toBe(0);
    expect(listed.posts.every((p: { state: string }) => p.state === "identical")).toBe(true);
  });
});
