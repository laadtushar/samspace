import { describe, it, expect, vi, beforeEach } from "vitest";
import { STARTER_PAGES } from "@/lib/starter-pages";
import { STARTER_POSTS, CRISIS_SUPPORT_ABROAD } from "@/lib/starter-posts";
import { pageSchema, unconfirmedPlaceholders } from "@/lib/page-format";
import { publicPage } from "@/lib/pages-public";
import { defaultContent } from "@/lib/default-content";

/**
 * The pages that ship with the site, and the import that adds them.
 *
 * The first one is a draft landing page with facts the practitioner has not
 * yet confirmed. What matters most is that those facts are unmistakably
 * unfinished, cannot be published while they are, and that nothing typed in
 * here can drift from the dashboard's own numbers.
 */

const abroad = STARTER_PAGES.find((p) => p.slug === "therapy-for-indians-abroad")!;

describe("the page for Indians living abroad", () => {
  it("exists, under the agreed address and wording", () => {
    expect(abroad).toBeDefined();
    expect(abroad.seoTitle).toBe("Indian Therapist Online for Indians Living Abroad");
    expect(abroad.seoDescription).toBe(
      "Online therapy with an Indian counselling psychologist who understands family pressure, homesickness and life between two cultures. In English or Hindi."
    );
    expect(abroad.title).toBe("Therapy with someone who already understands home");
  });

  it("saves as a draft through the same schema the dashboard uses", () => {
    const parsed = pageSchema.safeParse({ ...abroad, status: "draft" });
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("cannot be published while anything is still to confirm", () => {
    expect(pageSchema.safeParse({ ...abroad, status: "published" }).success).toBe(false);
  });

  it("marks each unconfirmed fact as a visible placeholder", () => {
    const placeholders = unconfirmedPlaceholders(abroad.content).join("\n");
    expect(unconfirmedPlaceholders(abroad.content)).toHaveLength(4);
    expect(placeholders).toMatch(/time zone/i);
    expect(placeholders).toMatch(/currency/i);
    expect(placeholders).toMatch(/pay/i);
    expect(placeholders).toMatch(/clients who live abroad/i);
    expect(placeholders).toMatch(/confidentiality/i);
    // Bold as well as bracketed, so it cannot be skimmed past on the page.
    expect(abroad.content).toMatch(/\*\*\[To confirm: [^\]]+\]\*\*/);
  });

  it("quotes fees only as {{rate.range}}, never as a typed figure", () => {
    expect(abroad.content).toContain("{{rate.range}}");
    expect(abroad.content).not.toMatch(/₹|\bRs\.?\s?\d|\bINR\b|\$\s?\d|rupee/i);
  });

  it("takes the session length from the dashboard, not from here", () => {
    expect(abroad.content).toContain("{{session.length}}");
    expect(abroad.content).not.toMatch(/45\s*[–-]\s*50|\bminutes\b/);
  });

  it("fills in both when shown, from the dashboard's values", () => {
    const shown = publicPage(abroad, defaultContent);
    expect(shown.content).toContain(defaultContent.sessionLength);
    expect(shown.content).not.toContain("{{");
  });

  it("sends someone in crisis to local emergency services first, then the site's helplines", () => {
    expect(abroad.content).toContain(CRISIS_SUPPORT_ABROAD);
    const emergency = abroad.content.indexOf("emergency services in your current country");
    expect(emergency).toBeGreaterThan(-1);
    expect(abroad.content.indexOf("9152987821")).toBeGreaterThan(emergency);
    expect(abroad.content).toContain("1860-2662-345");
  });

  it("links to the related posts and to booking", () => {
    for (const href of [
      "/blog/study-abroad-reality-indian-students",
      "/blog/long-distance-relationship-india-abroad",
      "/blog/boundaries-with-indian-parents",
      "/?intake=true",
    ]) {
      expect(abroad.content, href).toContain(`](${href})`);
    }
  });

  it("links only to posts that ship with the site", () => {
    const slugs = new Set(STARTER_POSTS.map((p) => p.slug));
    for (const [, slug] of abroad.content.matchAll(/\]\(\/blog\/([a-z0-9-]+)\)/g)) {
      expect(slugs.has(slug), slug).toBe(true);
    }
  });

  it("does not repeat its heading as a markdown H1", () => {
    expect(abroad.content.trimStart().startsWith("# ")).toBe(false);
  });
});

describe("sharing the crisis sentence did not change the posts", () => {
  it("leaves the study-abroad post's note word for word as it was", () => {
    const post = STARTER_POSTS.find((p) => p.slug === "study-abroad-reality-indian-students")!;
    expect(post.content.endsWith(
      "*If you're in immediate distress or having thoughts of self-harm, please reach out to emergency services in your current country. You can also contact iCall at 9152987821, or Vandrevala Foundation at 1860-2662-345 (24/7). This post is educational and isn't a substitute for individual care.*"
    )).toBe(true);
  });
});

/*
  The import itself, with the store standing in. Nothing in this repository
  writes the page to a database on deploy; this is the only way in.
*/
const savePage = vi.fn();
const existing = new Set<string>();
let owner: Response | null = null;

vi.mock("@/lib/admin-guard", () => ({
  ownerOrDenied: async () =>
    owner ? { identity: null, denied: owner } : { identity: { role: "owner" }, denied: null },
}));
vi.mock("@/lib/pages", () => ({
  getPageBySlug: async (slug: string) => (existing.has(slug) ? { slug } : null),
  savePage: (...a: unknown[]) => savePage(...a),
}));

const { POST, GET } = await import("@/app/api/admin/pages/import/route");

describe("importing the starter pages", () => {
  beforeEach(() => {
    savePage.mockReset().mockResolvedValue(undefined);
    existing.clear();
    owner = null;
  });

  it("adds each one as a draft", async () => {
    const body = await (await POST()).json();
    expect(body.imported).toContain("therapy-for-indians-abroad");
    for (const [input] of savePage.mock.calls) {
      expect(input.status).toBe("draft");
    }
  });

  it("never overwrites a page that is already there", async () => {
    existing.add("therapy-for-indians-abroad");
    const body = await (await POST()).json();
    expect(body.skipped).toContain("therapy-for-indians-abroad");
    expect(savePage).not.toHaveBeenCalled();
    expect((await (await GET()).json()).remaining).toBe(STARTER_PAGES.length - 1);
  });

  it("is an owner's button only", async () => {
    owner = new Response("no", { status: 403 });
    expect((await POST()).status).toBe(403);
    expect(savePage).not.toHaveBeenCalled();
  });
});
