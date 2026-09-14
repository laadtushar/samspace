import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Blob is billed per request, so public reads are cached for an hour. That is
 * only safe while every write clears the tag — otherwise an edit saved in the
 * dashboard would not appear for up to an hour, which reads as "the site is
 * broken" rather than "the cache is warm".
 *
 * These pin the wiring, so a write path added later cannot quietly skip it.
 */

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (tag: string) => revalidateTag(tag),
  // Pass through: the point here is invalidation, not the caching itself.
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

const writePublicJson = vi.fn(async () => {});
const writeConfidentialJson = vi.fn(async () => {});
const deleteBlob = vi.fn(async () => {});
vi.mock("@/lib/blob", () => ({
  writePublicJson: (...a: unknown[]) => writePublicJson(...(a as [])),
  readPublicJson: async (_k: string, fallback: unknown) => fallback,
  writeConfidentialJson: (...a: unknown[]) => writeConfidentialJson(...(a as [])),
  readConfidentialJson: async (_k: string, fallback: unknown) => fallback,
  listBlobs: async () => [],
  deleteBlob: (...a: unknown[]) => deleteBlob(...(a as [])),
}));

beforeEach(() => {
  revalidateTag.mockClear();
  writePublicJson.mockClear();
  writeConfidentialJson.mockClear();
});

describe("a write clears the cache it would otherwise outlive", () => {
  it("clears site content when content is saved", async () => {
    const { saveContent, defaultContent, CONTENT_TAG } = await import("@/lib/content");
    await saveContent(defaultContent);
    expect(writePublicJson).toHaveBeenCalled();
    expect(revalidateTag).toHaveBeenCalledWith(CONTENT_TAG);
  });

  it("clears posts when one is saved", async () => {
    const { savePost, POSTS_TAG } = await import("@/lib/blog");
    await savePost({
      slug: "a-post",
      title: "A post",
      excerpt: "",
      content: "Body.",
      coverImage: "",
      coverAlt: "",
      tags: [],
      status: "published",
      seoTitle: "",
      seoDescription: "",
      publishedAt: "",
    });
    expect(revalidateTag).toHaveBeenCalledWith(POSTS_TAG);
  });

  it("clears posts when one is deleted", async () => {
    const { deletePost, POSTS_TAG } = await import("@/lib/blog");
    await deletePost("a-post");
    expect(revalidateTag).toHaveBeenCalledWith(POSTS_TAG);
  });
});

describe("clearing the cache cannot undo a write", () => {
  it("still saves when revalidateTag throws", async () => {
    revalidateTag.mockImplementationOnce(() => {
      throw new Error("called outside a request scope");
    });
    const { saveContent, defaultContent } = await import("@/lib/content");
    await expect(saveContent(defaultContent)).resolves.toBeUndefined();
    expect(writePublicJson).toHaveBeenCalled();
  });
});

describe("a cached entry does not outlive the build that wrote it", () => {
  /*
    The bug: the cache key was a constant, so an entry written before a field
    existed was still served after the deployment that added it — the intake
    form's copy shipped and did not appear on the live site.

    Keying by build as well means a deployment starts cold, which costs one
    read per cached function and cannot serve a shape from older code.
  */
  it("includes something that changes with the code in the key", async () => {
    const { BUILD_ID } = await import("@/lib/build-id");
    expect(BUILD_ID).toBeTruthy();
  });

  it("prefers the commit sha when the platform provides one", async () => {
    vi.resetModules();
    const previous = process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.VERCEL_GIT_COMMIT_SHA = "abc123";
    try {
      const { BUILD_ID } = await import("@/lib/build-id");
      expect(BUILD_ID).toBe("abc123");
    } finally {
      if (previous === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
      else process.env.VERCEL_GIT_COMMIT_SHA = previous;
      vi.resetModules();
    }
  });

  it("falls back to a stable key rather than an unstable one", async () => {
    // A per-call value would make every call a cache miss, which is the
    // opposite of the point.
    vi.resetModules();
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    const dep = process.env.VERCEL_DEPLOYMENT_ID;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_DEPLOYMENT_ID;
    try {
      const first = (await import("@/lib/build-id")).BUILD_ID;
      vi.resetModules();
      const second = (await import("@/lib/build-id")).BUILD_ID;
      expect(first).toBe(second);
    } finally {
      if (sha !== undefined) process.env.VERCEL_GIT_COMMIT_SHA = sha;
      if (dep !== undefined) process.env.VERCEL_DEPLOYMENT_ID = dep;
      vi.resetModules();
    }
  });
});
