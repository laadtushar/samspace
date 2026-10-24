import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { STARTER_POSTS } from "@/lib/starter-posts";
import { blogPostSchema, safeLinkHref, SLUG_PATTERN } from "@/lib/validation";
import { deriveExcerpt, readingMinutes } from "@/lib/blog";
import { auditPosts } from "@/lib/price-audit";
import { TOKENS, TOKEN_PATTERN } from "@/lib/tokens";
import { defaultContent } from "@/lib/default-content";
import { toConfirm, unconfirmedPlaceholders } from "@/lib/placeholders";

/** Everything in a post a reader can see. */
const readable = (post: (typeof STARTER_POSTS)[number]) =>
  [post.title, post.excerpt, post.content, post.seoTitle, post.seoDescription];

/** An exam guide, not a therapy post: no crisis note, no sliding scale. */
const EXAM_GUIDE = "ugc-net-psychology-preparation";

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
      if (post.slug === EXAM_GUIDE) continue;
      expect(post.content, post.slug).toContain("9152987821");
      expect(post.content, post.slug).toContain("1860-2662-345");
    }
  });

  it("ends the exam guide with the mental-health posts instead of a crisis note", () => {
    const guide = STARTER_POSTS.find((p) => p.slug === EXAM_GUIDE);
    expect(guide).toBeDefined();
    expect(guide!.content).not.toContain("9152987821");
    const last = guide!.content.trim().split("\n").at(-1)!;
    expect(last).toContain("](/blog/high-functioning-anxiety)");
    expect(last).toContain("](/blog/do-i-need-therapy-or-overreacting)");
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
      // Any link into /blog/, with or without an anchor or query after the slug.
      const everywhere = readable(post).join("\n");
      for (const [, slug] of everywhere.matchAll(/\]\(\/blog\/([^)\s#?]*)/g)) {
        expect(slugs.has(slug), `${post.slug} links to /blog/${slug}`).toBe(true);
      }
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

  it("sends a reader abroad to the emergency services where they are", () => {
    // An Indian helpline is not the first call for someone in another country.
    for (const slug of [
      "study-abroad-reality-indian-students",
      "long-distance-relationship-india-abroad",
    ]) {
      const post = STARTER_POSTS.find((p) => p.slug === slug);
      expect(post, slug).toBeDefined();
      expect(post!.content, slug).toContain("emergency services in your current country");
    }
  });

  it("points at the intake form", () => {
    for (const post of STARTER_POSTS) {
      expect(post.content, post.slug).toContain("/?intake=true");
    }
  });
});

describe("prices are only ever tokens", () => {
  it("types no rupee figure anywhere a reader sees", () => {
    for (const post of STARTER_POSTS) {
      for (const text of readable(post)) {
        expect(text, post.slug).not.toMatch(/₹\s*\d/);
        // Nor the other ways a figure gets written by hand.
        expect(text, post.slug).not.toMatch(/\bRs\.?\s?\d|\bINR\s?\d/i);
      }
    }
  });

  it("gives the drift audit nothing to report against the default scale", () => {
    expect(defaultContent.slidingScale.length).toBeGreaterThan(0);
    const posts = STARTER_POSTS.map((post) => ({ ...post }));
    expect(auditPosts(posts, defaultContent.slidingScale)).toEqual([]);
  });

  it("would have caught the figure the drafts arrived with", () => {
    // The uploaded drafts said ₹600–₹1000 while the scale starts at ₹500.
    const stale = { slug: "stale", content: "Sessions run on a sliding scale (₹600–₹1000)." };
    expect(auditPosts([stale], defaultContent.slidingScale)).toHaveLength(1);
  });

  it("uses only tokens the site knows how to fill", () => {
    const known = new Set(TOKENS.map((t) => t.token.slice(2, -2).toLowerCase()));
    for (const post of STARTER_POSTS) {
      for (const text of readable(post)) {
        for (const [, name] of text.matchAll(TOKEN_PATTERN)) {
          expect(known.has(name.toLowerCase()), `${post.slug} uses {{${name}}}`).toBe(true);
        }
        // Anything brace-shaped that the pattern would not resolve is a typo
        // that would reach readers as written.
        const braces = text.match(/\{\{[^}]*\}\}/g) ?? [];
        const resolvable = text.match(TOKEN_PATTERN) ?? [];
        expect(braces, post.slug).toEqual(resolvable);
      }
    }
  });
});

describe("gaps for the practitioner", () => {
  it("shows every note for the author on the page, rather than hiding it in a comment", () => {
    // Raw HTML is not rendered, so a <!-- note --> would silently vanish.
    for (const post of STARTER_POSTS) {
      for (const text of readable(post)) expect(text, post.slug).not.toContain("<!--");
    }
  });

  it("marks the exam guide's personal details as placeholders", () => {
    const guide = STARTER_POSTS.find((p) => p.slug === EXAM_GUIDE)!;
    const found = unconfirmedPlaceholders(guide.content);
    expect(found).toHaveLength(8);
    // Bold as well as bracketed, so a preview cannot be skimmed past them.
    for (const placeholder of found) expect(guide.content).toContain(`**${placeholder}**`);
  });

  it("lets a post with placeholders be saved as a draft but not published", () => {
    const guide = STARTER_POSTS.find((p) => p.slug === EXAM_GUIDE)!;
    expect(blogPostSchema.safeParse({ ...guide, status: "draft" }).success).toBe(true);
    const published = blogPostSchema.safeParse({ ...guide, status: "published" });
    expect(published.success).toBe(false);
    expect(published.error?.issues[0]?.message).toMatch(/To confirm/);
  });

  it("can publish every other shipped post as it stands", () => {
    for (const post of STARTER_POSTS) {
      if (unconfirmedPlaceholders(readable(post).join("\n")).length > 0) continue;
      const parsed = blogPostSchema.safeParse({ ...post, status: "published" });
      expect(parsed.success, post.slug).toBe(true);
    }
  });
});

describe("the publish guard on posts", () => {
  const base = {
    slug: "a-post",
    title: "A post",
    excerpt: "",
    content: "Body",
    coverImage: "",
    seoTitle: "",
    seoDescription: "",
  };

  it("saves a draft that still has a placeholder", () => {
    for (const field of ["content", "title", "excerpt", "seoTitle", "seoDescription"] as const) {
      const parsed = blogPostSchema.safeParse({
        ...base,
        [field]: `Text ${toConfirm("something")}`,
        status: "draft",
      });
      expect(parsed.success, field).toBe(true);
    }
  });

  it("refuses to publish while any field a reader sees has one", () => {
    for (const field of ["content", "title", "excerpt", "seoTitle", "seoDescription"] as const) {
      for (const text of [`Text ${toConfirm("something")}`, "Text [To confirm: plain]"]) {
        const parsed = blogPostSchema.safeParse({ ...base, [field]: text, status: "published" });
        expect(parsed.success, `${field}: ${text}`).toBe(false);
        expect(parsed.error?.issues[0]?.message, field).toBe(
          "This post still has [To confirm: …] placeholders. Replace them before publishing."
        );
      }
    }
  });

  it("publishes once they are gone", () => {
    expect(blogPostSchema.safeParse({ ...base, status: "published" }).success).toBe(true);
  });
});
