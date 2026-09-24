import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { AUTHOR, AUTHOR_URL, authorPerson } from "@/lib/author";
import { defaultContent } from "@/lib/default-content";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/**
 * Who wrote the site's health writing has to be visible, and the three places
 * that say it — the byline, the author page, the structured data — must agree.
 */
describe("authorship", () => {
  it("puts a visible byline on every post, linking to the author page", () => {
    const post = read("app/blog/[slug]/page.tsx");
    expect(post).toContain('rel="author"');
    expect(post).toContain("href={AUTHOR.path}");
    expect(post).toContain("{AUTHOR.name}");
  });

  it("points the Person at the author page, with every credential", () => {
    const person = authorPerson(defaultContent);
    expect(person.url).toBe(AUTHOR_URL);
    expect(AUTHOR_URL.endsWith(AUTHOR.path)).toBe(true);
    expect(person.hasCredential.map((c) => c.credentialCategory)).toEqual([
      ...AUTHOR.credentials,
    ]);
  });

  it("uses one Person everywhere rather than a second hand-typed copy", () => {
    expect(read("app/layout.tsx")).toContain("authorPerson(defaultContent)");
    expect(read("app/layout.tsx")).not.toContain('"@type": "Person"');
    expect(read("app/about/page.tsx")).toContain("mainEntity: authorPerson(content)");
    expect(read("app/blog/[slug]/page.tsx")).toContain('author: { "@id": AUTHOR.id }');
  });

  it("lists the author page in the sitemap", () => {
    expect(read("app/sitemap.ts")).toContain("${SITE_URL}${AUTHOR.path}");
  });
});
