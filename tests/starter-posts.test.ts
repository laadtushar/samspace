import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { STARTER_POSTS } from "@/lib/starter-posts";
import { blogPostSchema, safeLinkHref, SLUG_PATTERN } from "@/lib/validation";
import { deriveExcerpt, readingMinutes } from "@/lib/blog";

/**
 * The posts that ship with the site.
 *
 * They go through the same schema as anything typed into the dashboard, so the
 * useful thing to assert is that they actually survive it — a cover path
 * silently stripped to "" by validation would leave four posts with no artwork
 * and nothing to say why. The SEO fields are checked against the limits search
 * results actually impose rather than against the schema's generous caps.
 */

describe("every starter post is valid input", () => {
  it("passes the same schema the dashboard editor posts through", () => {
    for (const post of STARTER_POSTS) {
      const result = blogPostSchema.safeParse({ ...post, status: "draft" });
      expect(result.success, `${post.slug}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it("keeps its cover image through validation", () => {
    // safeLinkHref returns "" for anything it will not vouch for. A cover that
    // vanished here would ship four posts with no artwork and no error.
    for (const post of STARTER_POSTS) {
      expect(safeLinkHref(post.coverImage), post.slug).toBe(post.coverImage);
      const parsed = blogPostSchema.parse({ ...post, status: "draft" });
      expect(parsed.coverImage, post.slug).toBe(post.coverImage);
    }
  });

  it("has a slug that matches the blog's own pattern", () => {
    for (const post of STARTER_POSTS) {
      expect(post.slug, post.slug).toMatch(SLUG_PATTERN);
    }
  });

  it("has no duplicate slugs", () => {
    const slugs = STARTER_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("the artwork exists", () => {
  it("ships a file for every cover it references", () => {
    for (const post of STARTER_POSTS) {
      const path = `public${post.coverImage}`;
      expect(existsSync(path), `${post.slug} references ${path}`).toBe(true);
    }
  });

  it("describes each cover for anyone who cannot see it", () => {
    for (const post of STARTER_POSTS) {
      expect(post.coverAlt.length, post.slug).toBeGreaterThan(15);
      // Alt text saying "image" describes the medium, not the picture.
      expect(post.coverAlt.toLowerCase()).not.toMatch(/^(image|picture|photo)\b/);
    }
  });

  it("carries a title element, so the artwork is not silent to a screen reader", () => {
    for (const post of STARTER_POSTS) {
      const svg = readFileSync(`public${post.coverImage}`, "utf8");
      expect(svg, post.slug).toContain("<title");
      expect(svg, post.slug).toContain('role="img"');
    }
  });

  it("holds still for anyone who asked for less motion", () => {
    for (const post of STARTER_POSTS) {
      const svg = readFileSync(`public${post.coverImage}`, "utf8");
      expect(svg, post.slug).toContain("prefers-reduced-motion");
    }
  });

  it("references nothing off this site and runs no script", () => {
    for (const post of STARTER_POSTS) {
      const svg = readFileSync(`public${post.coverImage}`, "utf8");
      expect(svg, post.slug).not.toMatch(/<script/i);
      expect(svg, post.slug).not.toMatch(/https?:\/\/(?!www\.w3\.org)/i);
    }
  });
});

describe("the SEO fields are the right shape for a search result", () => {
  it("keeps titles inside what Google will show", () => {
    for (const post of STARTER_POSTS) {
      expect(post.seoTitle.length, `${post.slug}: "${post.seoTitle}"`).toBeGreaterThan(20);
      // Past roughly 60 characters the tail is replaced with an ellipsis.
      expect(post.seoTitle.length, `${post.slug}: "${post.seoTitle}"`).toBeLessThanOrEqual(65);
    }
  });

  it("keeps descriptions inside the snippet length", () => {
    for (const post of STARTER_POSTS) {
      expect(post.seoDescription.length, post.slug).toBeGreaterThan(70);
      expect(post.seoDescription.length, post.slug).toBeLessThanOrEqual(165);
    }
  });

  it("gives every post its own title and description", () => {
    const titles = STARTER_POSTS.map((p) => p.seoTitle);
    const descriptions = STARTER_POSTS.map((p) => p.seoDescription);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("writes an excerpt rather than leaning on the derived one", () => {
    for (const post of STARTER_POSTS) {
      expect(post.excerpt.length, post.slug).toBeGreaterThan(60);
      expect(post.excerpt, post.slug).not.toBe(deriveExcerpt(post.content));
    }
  });

  it("tags every post, for the archive and for related reading", () => {
    for (const post of STARTER_POSTS) {
      expect(post.tags.length, post.slug).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("the writing itself", () => {
  it("starts with prose, not a repeated H1", () => {
    // The page renders post.title as the H1 already; a second one in the body
    // gives every post two competing headings.
    for (const post of STARTER_POSTS) {
      expect(post.content.trimStart().startsWith("# "), post.slug).toBe(false);
    }
  });

  it("is long enough to be worth ranking", () => {
    for (const post of STARTER_POSTS) {
      expect(readingMinutes(post.content), post.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it("carries the crisis-support note", () => {
    for (const post of STARTER_POSTS) {
      expect(post.content, post.slug).toContain("9152987821");
      expect(post.content, post.slug).toContain("1860-2662-345");
    }
  });

  it("links internally with site-relative paths, not absolute ones", () => {
    // An absolute link to the production domain sends a preview deployment's
    // readers to production mid-article, and costs a redirect for everyone else.
    for (const post of STARTER_POSTS) {
      expect(post.content, post.slug).not.toContain("https://www.samvritispace.com");
    }
  });

  it("links to other posts that actually exist", () => {
    const slugs = new Set(STARTER_POSTS.map((p) => p.slug));
    for (const post of STARTER_POSTS) {
      const links = [...post.content.matchAll(/\]\(\/blog\/([a-z0-9-]+)\)/g)];
      for (const [, slug] of links) {
        expect(slugs.has(slug), `${post.slug} links to /blog/${slug}`).toBe(true);
      }
      expect(links.some(([, slug]) => slug !== post.slug), `${post.slug} has no internal link`).toBe(true);
    }
  });

  it("never links to itself", () => {
    for (const post of STARTER_POSTS) {
      expect(post.content, post.slug).not.toContain(`](/blog/${post.slug})`);
    }
  });

  it("points at the intake form", () => {
    for (const post of STARTER_POSTS) {
      expect(post.content, post.slug).toContain("/?intake=true");
    }
  });
});
