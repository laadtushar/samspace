import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { AUTHOR, AUTHOR_URL, AUTHOR_REFERENCE, authorPerson } from "@/lib/author";
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
    // Each credential by name; credentialCategory is for the kind ("degree").
    expect(person.hasCredential.map((c) => c.name)).toEqual([...AUTHOR.credentials]);
    expect(person.hasCredential.some((c) => "credentialCategory" in c)).toBe(false);
  });

  it("uses one Person everywhere rather than a second hand-typed copy", () => {
    // The layout reads the same content /about does, so the one @id cannot
    // carry two different sets of profiles.
    expect(read("app/layout.tsx")).toContain("authorPerson(head)");
    expect(read("app/layout.tsx")).not.toContain("defaultContent");
    expect(read("app/layout.tsx")).not.toContain('"@type": "Person"');
    expect(read("app/about/page.tsx")).toContain("mainEntity: authorPerson(content)");
    expect(read("app/blog/[slug]/page.tsx")).toContain("author: AUTHOR_REFERENCE");
  });

  it("names the post author in the post's own block, as Google lists for articles", () => {
    expect(AUTHOR_REFERENCE).toEqual({
      "@type": "Person",
      "@id": authorPerson(defaultContent)["@id"],
      name: AUTHOR.name,
      url: AUTHOR_URL,
      jobTitle: AUTHOR.jobTitle,
    });
  });

  it("lists the author page in the sitemap", () => {
    expect(read("app/sitemap.ts")).toContain("${SITE_URL}${AUTHOR.path}");
  });
});
