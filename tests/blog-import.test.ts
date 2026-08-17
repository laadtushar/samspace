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
  savePost: async (input: Record<string, unknown>) => {
    if (input.slug === saveShouldFailFor) throw new Error("storage unavailable");
    store.set(String(input.slug), input);
    return input;
  },
}));

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
  saveShouldFailFor = null;
  role = "owner";
});

describe("importing the shipped posts", () => {
  it("adds all of them the first time", async () => {
    const { POST } = await load();
    const { STARTER_POSTS } = await import("@/lib/starter-posts");

    const body = await (await POST()).json();

    expect(body.imported).toHaveLength(STARTER_POSTS.length);
    expect(body.skipped).toHaveLength(0);
    expect(body.failed).toHaveLength(0);
    expect(store.size).toBe(STARTER_POSTS.length);
  });

  it("adds them as drafts, never published", async () => {
    // Four posts going live from one button press, with nobody having read
    // them on the real site first, is not a decision a button should make.
    const { POST } = await load();
    await POST();

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
    const body = await (await POST()).json();

    expect(body.skipped).toContain(existing.slug);
    expect(body.imported).not.toContain(existing.slug);
    // The edit survives, which is the whole reason the button is safe to press.
    expect(store.get(existing.slug)?.title).toBe("Title the practitioner rewrote");
    expect(store.get(existing.slug)?.status).toBe("published");
  });

  it("is safe to press twice", async () => {
    const { POST } = await load();
    const { STARTER_POSTS } = await import("@/lib/starter-posts");

    await POST();
    const second = await (await POST()).json();

    expect(second.imported).toHaveLength(0);
    expect(second.skipped).toHaveLength(STARTER_POSTS.length);
    expect(store.size).toBe(STARTER_POSTS.length);
  });

  it("keeps going when one post cannot be saved", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    saveShouldFailFor = STARTER_POSTS[1].slug;

    const { POST } = await load();
    const body = await (await POST()).json();

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
    await POST();

    const after = await (await GET()).json();
    expect(after.remaining).toBe(0);
    expect(after.posts.every((p: { alreadyPresent: boolean }) => p.alreadyPresent)).toBe(true);
  });
});

describe("who is allowed to press it", () => {
  it("refuses a member", async () => {
    role = "member";
    const { POST } = await load();
    const res = await POST();

    expect(res.status).toBe(403);
    expect(store.size).toBe(0);
  });

  it("refuses someone with no session", async () => {
    role = null;
    const { POST } = await load();
    const res = await POST();

    expect(res.status).toBe(401);
    expect(store.size).toBe(0);
  });

  it("refuses to even list for a member", async () => {
    role = "member";
    const { GET } = await load();
    expect((await GET()).status).toBe(403);
  });
});
