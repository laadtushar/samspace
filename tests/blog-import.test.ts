import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The button that copies the shipped posts into the blog.
 *
 * Storage is mocked because the point of these tests is the decisions the route
 * makes — what it skips, what it refuses, what it does when one post fails —
 * and none of that is about blob storage working. The properties that matter
 * are the destructive ones: it must never overwrite an edited post, and it must
 * never publish anything on its own.
 */

const store = new Map<string, Record<string, unknown>>();
let saveShouldFailFor: string | null = null;

vi.mock("@/lib/blog", () => ({
  getPostBySlug: async (slug: string) => store.get(slug) ?? null,
  // Enough of the real savePost to test what a replace keeps: the id carries
  // over and publishedAt, once set, is not moved.
  savePost: async (input: Record<string, unknown>) => {
    if (input.slug === saveShouldFailFor) throw new Error("storage unavailable");
    const existing = store.get(String(input.slug));
    const post = {
      ...input,
      id: existing?.id ?? input.id ?? `id-${String(input.slug)}`,
      publishedAt:
        input.publishedAt ||
        existing?.publishedAt ||
        (input.status === "published" ? "2026-10-24T00:00:00.000Z" : ""),
    };
    store.set(String(input.slug), post);
    return post;
  },
}));

const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidated.push(path),
}));

/** What the dashboard sends today: a POST with nothing in it. */
const noBody = () => new Request("http://localhost/api/admin/blog/import", { method: "POST" });
const withBody = (body: unknown) =>
  new Request("http://localhost/api/admin/blog/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

let role: "owner" | "member" | null = "owner";

vi.mock("@/lib/admin-guard", async () => {
  const { NextResponse } = await import("next/server");
  return {
    ownerOrDenied: async () => {
      if (role === null) {
        return {
          identity: null,
          denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
      }
      if (role !== "owner") {
        return {
          identity: null,
          denied: NextResponse.json({ error: "Only an owner" }, { status: 403 }),
        };
      }
      return { identity: { role: "owner", name: "Owner" }, denied: null };
    },
  };
});

const load = async () => import("@/app/api/admin/blog/import/route");

beforeEach(() => {
  store.clear();
  revalidated.length = 0;
  saveShouldFailFor = null;
  role = "owner";
});

describe("importing the shipped posts", () => {
  it("adds all of them the first time", async () => {
    const { POST } = await load();
    const { STARTER_POSTS } = await import("@/lib/starter-posts");

    const body = await (await POST(noBody())).json();

    expect(body.imported).toHaveLength(STARTER_POSTS.length);
    expect(body.skipped).toHaveLength(0);
    expect(body.failed).toHaveLength(0);
    expect(store.size).toBe(STARTER_POSTS.length);
  });

  it("adds them as drafts, never published", async () => {
    // Four posts going live from one button press, with nobody having read
    // them on the real site first, is not a decision a button should make.
    const { POST } = await load();
    await POST(noBody());

    for (const post of store.values()) {
      expect(post.status).toBe("draft");
      expect(post.publishedAt).toBe("");
    }
  });

  it("skips a post that is already there rather than overwriting it", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    const existing = STARTER_POSTS[0];
    store.set(existing.slug, {
      slug: existing.slug,
      title: "Title the practitioner rewrote",
      status: "published",
    });

    const { POST } = await load();
    const body = await (await POST(noBody())).json();

    expect(body.skipped).toContain(existing.slug);
    expect(body.imported).not.toContain(existing.slug);
    // The edit survives, which is the whole reason the button is safe to press.
    expect(store.get(existing.slug)?.title).toBe("Title the practitioner rewrote");
    expect(store.get(existing.slug)?.status).toBe("published");
  });

  it("is safe to press twice", async () => {
    const { POST } = await load();
    const { STARTER_POSTS } = await import("@/lib/starter-posts");

    await POST(noBody());
    const second = await (await POST(noBody())).json();

    expect(second.imported).toHaveLength(0);
    expect(second.skipped).toHaveLength(STARTER_POSTS.length);
    expect(store.size).toBe(STARTER_POSTS.length);
  });

  it("keeps going when one post cannot be saved", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    saveShouldFailFor = STARTER_POSTS[1].slug;

    const { POST } = await load();
    const body = await (await POST(noBody())).json();

    expect(body.failed).toEqual([STARTER_POSTS[1].slug]);
    expect(body.imported).toHaveLength(STARTER_POSTS.length - 1);
    // A reference to quote, since the message says something went wrong.
    expect(body.ref).toBeTruthy();
  });

  it("reports what is left rather than making the dashboard guess", async () => {
    const { GET } = await load();
    const { STARTER_POSTS } = await import("@/lib/starter-posts");

    const before = await (await GET()).json();
    expect(before.remaining).toBe(STARTER_POSTS.length);

    const { POST } = await load();
    await POST(noBody());

    const after = await (await GET()).json();
    expect(after.remaining).toBe(0);
    expect(after.posts.every((p: { alreadyPresent: boolean }) => p.alreadyPresent)).toBe(true);
  });
});

describe("who is allowed to press it", () => {
  it("refuses a member", async () => {
    role = "member";
    const { POST } = await load();
    const res = await POST(noBody());

    expect(res.status).toBe(403);
    expect(store.size).toBe(0);
  });

  it("refuses someone with no session", async () => {
    role = null;
    const { POST } = await load();
    const res = await POST(noBody());

    expect(res.status).toBe(401);
    expect(store.size).toBe(0);
  });

  it("refuses to even list for a member", async () => {
    role = "member";
    const { GET } = await load();
    expect((await GET()).status).toBe(403);
  });
});

describe("a POST with no body", () => {
  it("imports the missing posts, exactly as before, whatever else is in the blog", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    const { POST } = await load();
    store.set(STARTER_POSTS[0].slug, { slug: STARTER_POSTS[0].slug, title: "Edited", status: "published" });

    const body = await (await POST(withBody(""))).json();

    expect(body.skipped).toEqual([STARTER_POSTS[0].slug]);
    expect(body.imported).toHaveLength(STARTER_POSTS.length - 1);
    expect(store.get(STARTER_POSTS[0].slug)?.title).toBe("Edited");
    // An import of drafts changes nothing a reader can see.
    expect(revalidated).toEqual([]);
  });
});

/** A post as it would sit in the blog after an import, then a publish. */
function seedPublished(slug: string, over: Record<string, unknown> = {}) {
  store.set(slug, {
    id: "post-1",
    slug,
    title: "An older title",
    excerpt: "An older excerpt.",
    content: "Older text the practitioner has since rewritten.",
    tags: ["Old tag"],
    seoTitle: "Older SEO title",
    seoDescription: "Older SEO description.",
    coverImage: "/media/a-cover-chosen-in-the-dashboard.png",
    coverAlt: "A cover chosen in the dashboard",
    status: "published",
    publishedAt: "2026-01-15T09:30:00.000Z",
    ...over,
  });
}

describe("comparing the blog with the shipped version", () => {
  it("reports each post as missing, identical or different", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    const [first, second] = STARTER_POSTS;
    const { GET, POST } = await load();

    const before = await (await GET()).json();
    expect(before.posts.every((p: { state: string }) => p.state === "missing")).toBe(true);
    expect(before.differing).toBe(0);

    await POST(noBody());
    store.set(second.slug, { ...store.get(second.slug), content: "Edited in the dashboard." });
    store.delete(first.slug);

    const after = await (await GET()).json();
    const state = (slug: string) =>
      after.posts.find((p: { slug: string }) => p.slug === slug).state;
    expect(state(first.slug)).toBe("missing");
    expect(state(second.slug)).toBe("differs");
    expect(state(STARTER_POSTS[2].slug)).toBe("identical");
    expect(after.remaining).toBe(1);
    expect(after.differing).toBe(1);
  });

  it("compares every field a replace would overwrite, and only those", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    const starter = STARTER_POSTS[2];
    const { GET, POST } = await load();
    await POST(noBody());
    const state = async () =>
      (await (await GET()).json()).posts.find((p: { slug: string }) => p.slug === starter.slug).state;

    const original = { ...store.get(starter.slug)! };
    for (const [field, changed] of Object.entries({
      title: "Another title",
      excerpt: "Another excerpt.",
      content: "Other words.",
      tags: [...starter.tags, "Extra"],
      seoTitle: "Another SEO title",
      seoDescription: "Another SEO description.",
    })) {
      store.set(starter.slug, { ...original, [field]: changed });
      expect(await state(), field).toBe("differs");
    }

    // The post's own settings are not "the shipped text", so they never count.
    store.set(starter.slug, {
      ...original,
      status: "published",
      publishedAt: "2026-01-15T09:30:00.000Z",
      coverImage: "/media/other.png",
      coverAlt: "Other",
    });
    expect(await state()).toBe("identical");
  });
});

describe("updating a post to the shipped version", () => {
  it("replaces the words and keeps the post's id, address, status, date and cover", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    const starter = STARTER_POSTS.find((p) => p.slug === "overthinking-vs-anxiety")!;
    seedPublished(starter.slug);
    const { POST } = await load();

    const res = await POST(withBody({ replace: [starter.slug] }));
    expect(res.status).toBe(200);
    expect((await res.json()).replaced).toEqual([starter.slug]);

    const saved = store.get(starter.slug)!;
    expect(saved.title).toBe(starter.title);
    expect(saved.excerpt).toBe(starter.excerpt);
    expect(saved.content).toBe(starter.content);
    expect(saved.tags).toEqual(starter.tags);
    expect(saved.seoTitle).toBe(starter.seoTitle);
    expect(saved.seoDescription).toBe(starter.seoDescription);

    expect(saved.id).toBe("post-1");
    expect(saved.slug).toBe(starter.slug);
    expect(saved.status).toBe("published");
    expect(saved.publishedAt).toBe("2026-01-15T09:30:00.000Z");
    expect(saved.coverImage).toBe("/media/a-cover-chosen-in-the-dashboard.png");
    expect(saved.coverAlt).toBe("A cover chosen in the dashboard");

    // Readers see it straight away, as after any save.
    expect(revalidated).toContain("/blog");
    expect(revalidated).toContain(`/blog/${starter.slug}`);
  });

  it("then reports the post as identical", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    const starter = STARTER_POSTS[0];
    seedPublished(starter.slug);
    const { GET, POST } = await load();

    await POST(withBody({ replace: [starter.slug] }));
    const listed = (await (await GET()).json()).posts.find(
      (p: { slug: string }) => p.slug === starter.slug
    );
    expect(listed.state).toBe("identical");
  });

  it("keeps a draft a draft", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    const starter = STARTER_POSTS[1];
    seedPublished(starter.slug, { status: "draft", publishedAt: "" });
    const { POST } = await load();

    expect((await POST(withBody({ replace: [starter.slug] }))).status).toBe(200);
    expect(store.get(starter.slug)?.status).toBe("draft");
    expect(store.get(starter.slug)?.publishedAt).toBe("");
  });

  it("refuses to publish [To confirm: …] placeholders on a live post", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    const { unconfirmedPlaceholders } = await import("@/lib/placeholders");
    const withGaps = STARTER_POSTS.find((p) => unconfirmedPlaceholders(p.content).length > 0);
    expect(withGaps, "a shipped post with placeholders to test against").toBeDefined();
    seedPublished(withGaps!.slug);
    const { POST } = await load();

    const res = await POST(withBody({ replace: [withGaps!.slug] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/To confirm/);
    expect(store.get(withGaps!.slug)?.title).toBe("An older title");
    expect(revalidated).toEqual([]);
  });

  it("allows the same post while it is still a draft", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    const { unconfirmedPlaceholders } = await import("@/lib/placeholders");
    const withGaps = STARTER_POSTS.find((p) => unconfirmedPlaceholders(p.content).length > 0)!;
    seedPublished(withGaps.slug, { status: "draft", publishedAt: "" });
    const { POST } = await load();

    expect((await POST(withBody({ replace: [withGaps.slug] }))).status).toBe(200);
    expect(store.get(withGaps.slug)?.content).toBe(withGaps.content);
  });

  it("refuses a slug that does not ship with the site, and writes nothing", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    seedPublished(STARTER_POSTS[0].slug);
    seedPublished("a-post-written-in-the-dashboard");
    const { POST } = await load();

    const res = await POST(
      withBody({ replace: [STARTER_POSTS[0].slug, "a-post-written-in-the-dashboard"] })
    );
    expect(res.status).toBe(400);
    expect(store.get(STARTER_POSTS[0].slug)?.title).toBe("An older title");
    expect(store.get("a-post-written-in-the-dashboard")?.title).toBe("An older title");
  });

  it("refuses a shipped post that is not in the blog, and writes nothing", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    seedPublished(STARTER_POSTS[0].slug);
    const { POST } = await load();

    const res = await POST(withBody({ replace: [STARTER_POSTS[0].slug, STARTER_POSTS[1].slug] }));
    expect(res.status).toBe(404);
    expect(store.get(STARTER_POSTS[0].slug)?.title).toBe("An older title");
    expect(store.has(STARTER_POSTS[1].slug)).toBe(false);
  });

  it("refuses a body that is not a list of slugs", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    seedPublished(STARTER_POSTS[0].slug);
    const { POST } = await load();

    for (const body of [
      "not json",
      { replace: [] },
      { replace: STARTER_POSTS[0].slug },
      { replace: [STARTER_POSTS[0].slug], status: "published" },
      { slugs: [STARTER_POSTS[0].slug] },
      [STARTER_POSTS[0].slug],
    ]) {
      const res = await POST(withBody(body));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(store.get(STARTER_POSTS[0].slug)?.title).toBe("An older title");
  });

  it("refuses a member, and someone with no session", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    seedPublished(STARTER_POSTS[0].slug);
    const { POST } = await load();

    role = "member";
    expect((await POST(withBody({ replace: [STARTER_POSTS[0].slug] }))).status).toBe(403);
    role = null;
    expect((await POST(withBody({ replace: [STARTER_POSTS[0].slug] }))).status).toBe(401);
    expect(store.get(STARTER_POSTS[0].slug)?.title).toBe("An older title");
    expect(revalidated).toEqual([]);
  });
});
