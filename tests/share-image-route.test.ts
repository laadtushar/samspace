import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The post lookup behind /blog/[slug]/opengraph-image and twitter-image:
 * the same published-post query and token filling as the page, and what the
 * image does when there is no post or no database.
 */

const blog = vi.hoisted(() => ({ getPublishedPostBySlug: vi.fn() }));
vi.mock("@/lib/blog", () => blog);

vi.mock("@/lib/content", async () => {
  const { defaultContent } = await vi.importActual<typeof import("@/lib/content")>("@/lib/content");
  return { publicContent: async () => defaultContent };
});

const { shareImageMetadata, shareImageResponse, findShareTitle, SHARE_IMAGE_ID } = await import("@/lib/share-image/post");

const post = (over: Record<string, unknown> = {}) => ({
  slug: "a-post",
  title: "Overthinking vs. Anxiety: How to Tell the Difference",
  seoTitle: "",
  ...over,
});

beforeEach(() => {
  blog.getPublishedPostBySlug.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the share title", () => {
  it("is the SEO title without the site suffix, tokens filled, like og:title", async () => {
    blog.getPublishedPostBySlug.mockResolvedValue(post({ seoTitle: "Costs: {{rate.range}} | Samvriti.Space" }));
    const title = await findShareTitle("a-post");
    expect(title).toMatch(/^Costs: ₹\d/);
    expect(title).not.toContain("{{");
    expect(title).not.toContain("Samvriti.Space");
    expect(blog.getPublishedPostBySlug).toHaveBeenCalledWith("a-post");
  });

  it("falls back to the title when there is no SEO title", async () => {
    blog.getPublishedPostBySlug.mockResolvedValue(post());
    expect(await findShareTitle("a-post")).toBe("Overthinking vs. Anxiety: How to Tell the Difference");
  });
});

describe("image metadata", () => {
  it("describes one 1200×630 PNG with the title as alt text", async () => {
    blog.getPublishedPostBySlug.mockResolvedValue(post());
    expect(await shareImageMetadata("a-post")).toEqual([
      {
        id: SHARE_IMAGE_ID,
        alt: "Overthinking vs. Anxiety: How to Tell the Difference — Priyanka Varma on Samvriti.Space",
        size: { width: 1200, height: 630 },
        contentType: "image/png",
      },
    ]);
  });

  it("offers no image for a missing or unpublished post", async () => {
    // getPublishedPostBySlug is null for drafts as well as for missing slugs.
    blog.getPublishedPostBySlug.mockResolvedValue(null);
    expect(await shareImageMetadata("a-draft")).toEqual([]);
  });

  it("does not take the page down when the database is unreachable", async () => {
    blog.getPublishedPostBySlug.mockRejectedValue(new Error("connection refused"));
    const meta = await shareImageMetadata("a-post");
    expect(meta).toHaveLength(1);
    expect(meta[0].alt).toContain("A space to feel seen");
  });

  it("lets Next's own signals through", async () => {
    const signal = Object.assign(new Error("Dynamic server usage"), { digest: "DYNAMIC_SERVER_USAGE" });
    blog.getPublishedPostBySlug.mockRejectedValue(signal);
    await expect(shareImageMetadata("a-post")).rejects.toBe(signal);
  });
});

describe("the image response", () => {
  it("is a 404, not a picture, for a missing or unpublished post", async () => {
    blog.getPublishedPostBySlug.mockResolvedValue(null);
    const res = await shareImageResponse("nope");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).not.toBe("image/png");
  });

  it("renders the post's card, cached for minutes rather than a year", async () => {
    blog.getPublishedPostBySlug.mockResolvedValue(post());
    const res = await shareImageResponse("a-post");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
    expect(res.headers.get("cache-control")).not.toContain("immutable");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  }, 30_000);

  it("draws the brand card, uncached, when the database fails", async () => {
    blog.getPublishedPostBySlug.mockRejectedValue(new Error("connection refused"));
    const res = await shareImageResponse("a-post");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("no-store, max-age=0");
  }, 30_000);
});
