import { describe, it, expect, vi, afterEach } from "vitest";
import { defaultContent } from "@/lib/default-content";
import { resolveContentTokens, toPublicContent } from "@/lib/content";
import { llmsTxt, llmsFullTxt, demoteHeadings, LLMS_FULL_PATH } from "@/lib/llms";
import { AUTHOR, AUTHOR_URL } from "@/lib/author";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * /llms.txt and /llms-full.txt. They describe the practice to answer engines,
 * so they must say what the pages say: the same prices, the same author, the
 * same crisis numbers, and every published post.
 */
const content = toPublicContent(resolveContentTokens(defaultContent));

const posts = [
  {
    slug: "newest",
    title: "Overthinking [and] anxiety",
    excerpt: "Two things\nthat feel alike.",
    content: "Opening line.\n\n## Why it happens\n\nText.\n\n```\n# not a heading\n```",
    publishedAt: "2026-10-21T19:54:39.183Z",
    updatedAt: "2026-10-22T08:00:00.000Z",
    tags: ["Anxiety"],
  },
  {
    slug: "older",
    title: "Boundaries",
    excerpt: "Saying no.",
    content: "Body.",
    publishedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    tags: [],
  },
];

describe("llms.txt", () => {
  const txt = llmsTxt(content, posts);

  it("follows llmstxt.org: H1 name, blockquote summary, then H2 link lists ending in Optional", () => {
    const lines = txt.split("\n");
    expect(lines[0]).toBe(`# ${SITE_NAME}`);
    expect(lines[2].startsWith("> ")).toBe(true);
    expect(txt.match(/^# /gm)).toHaveLength(1);
    const h2 = lines.filter((l) => l.startsWith("## "));
    expect(h2).toEqual(["## Start here", "## Writing", "## Optional"]);
    // Nothing but headings, blank lines and list items after the first H2.
    const after = lines.slice(lines.indexOf("## Start here"));
    for (const l of after) expect(l === "" || l.startsWith("## ") || l.startsWith("- [")).toBe(true);
  });

  it("names the author and her credentials from AUTHOR", () => {
    expect(txt).toContain(`${AUTHOR.name}, ${AUTHOR.jobTitle}: ${AUTHOR.summary}`);
    expect(txt).toContain(`(${AUTHOR_URL})`);
  });

  it("quotes prices from the rates list with the tokens filled", () => {
    expect(txt).not.toContain("{{");
    for (const rate of content.slidingScale) expect(txt).toContain(rate);
  });

  it("carries the crisis notice and every helpline", () => {
    expect(txt).toContain(content.crisis.notice);
    for (const h of content.crisis.helplines) expect(txt).toContain(`${h.name}: ${h.number}`);
  });

  it("links every post with its excerpt and dates, brackets escaped", () => {
    expect(txt).toContain(
      `- [Overthinking \\[and\\] anxiety](${SITE_URL}/blog/newest): Two things that feel alike. (published 2026-10-21, updated 2026-10-22)`
    );
    // Unchanged since publishing, so no second date.
    expect(txt).toContain(`(${SITE_URL}/blog/older): Saying no. (published 2026-08-01)`);
  });

  it("leaves out the writing section rather than leave it empty", () => {
    expect(llmsTxt(content, [])).not.toContain("## Writing");
    expect(llmsFullTxt(content, [])).not.toContain("## Writing");
  });

  it("points at the full-text companion", () => {
    expect(txt).toContain(`(${SITE_URL}${LLMS_FULL_PATH})`);
  });

  it("never carries the private phone number", () => {
    const withPhone = toPublicContent({
      ...resolveContentTokens(defaultContent),
      contact: { ...defaultContent.contact, phone: "+91 98765 43210" },
    });
    expect(llmsTxt(withPhone, posts)).not.toContain("98765");
    expect(llmsFullTxt(withPhone, posts)).not.toContain("98765");
  });
});

describe("llms-full.txt", () => {
  const full = llmsFullTxt(content, posts);

  it("has every FAQ answer and every post body in full", () => {
    for (const item of content.faq.items) {
      expect(full).toContain(`### ${item.question}`);
      expect(full).toContain(item.answer);
    }
    expect(full).toContain("Opening line.");
    expect(full).toContain(`URL: ${SITE_URL}/blog/older`);
    expect(full).toContain(`By ${AUTHOR.name}, ${AUTHOR.jobTitle}; published 2026-10-21, updated 2026-10-22.`);
  });

  it("nests a post's own sections under its title", () => {
    expect(full).toContain("#### Why it happens");
    expect(full).toContain("# not a heading");
  });
});

describe("demoteHeadings", () => {
  it("demotes headings, caps at six, and leaves fenced code alone", () => {
    expect(demoteHeadings("## A\n###### B\n```\n## C\n```\n#hashtag", 2)).toBe(
      "#### A\n###### B\n```\n## C\n```\n#hashtag"
    );
  });
});

describe("the routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("still describe the practice, unindexed, when the database cannot be read", async () => {
    // The builders above loaded lib/llms already; the routes need it fresh,
    // over the mocks.
    vi.resetModules();
    vi.doMock("next/cache", async (importOriginal) => ({
      ...(await importOriginal<typeof import("next/cache")>()),
      unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
    }));
    vi.doMock("@/lib/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/db")>()),
      dbConfigured: () => true,
      sql: () => {
        throw new Error("database unreachable");
      },
    }));

    for (const path of ["@/app/llms.txt/route", "@/app/llms-full.txt/route"]) {
      const { GET } = await import(path);
      const res: Response = await GET();
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
      expect(res.headers.get("x-robots-tag")).toBe("noindex");
      const body = await res.text();
      expect(body.startsWith(`# ${SITE_NAME}\n`)).toBe(true);
      expect(body).toContain(defaultContent.crisis.notice);
    }
  });
});
