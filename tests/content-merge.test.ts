import { describe, it, expect } from "vitest";
import { mergeContent, defaultContent, resolveContentTokens } from "@/lib/content";
import { siteContentSchema } from "@/lib/validation";

/**
 * Stored content wins over the defaults, but only where it has something to
 * say. Everything the site adds after the dashboard has been used depends on
 * that distinction, and it is one level deep, which is easy to forget.
 */

describe("merging stored content over the defaults", () => {
  it("serves a key the stored document has never seen", () => {
    // The whole reason new copy can ship: a content document written before
    // sessionStructure existed must still render it.
    const stored = { hero: { headline: "Edited" } };
    const merged = mergeContent(stored);
    expect(merged.sessionStructure.steps.length).toBeGreaterThan(0);
    expect(merged.sessionStructure).toEqual(defaultContent.sessionStructure);
  });

  it("lets stored content win where it does have something to say", () => {
    const merged = mergeContent({ hero: { headline: "Edited" } });
    expect(merged.hero.headline).toBe("Edited");
  });

  it("keeps a sibling default when an object is partly overridden", () => {
    const merged = mergeContent({ hero: { headline: "Edited" } });
    expect(merged.hero.subtext).toBe(defaultContent.hero.subtext);
  });

  it("replaces an array wholesale rather than merging into it", () => {
    // This is why a price change in the defaults does not reach a live site,
    // and why the reprice tool exists. Pinned so it cannot change silently.
    const merged = mergeContent({ slidingScale: ["₹700"] });
    expect(merged.slidingScale).toEqual(["₹700"]);
  });

  it("drops a key the site never asked for", () => {
    const merged = mergeContent({ somethingElse: "no" }) as unknown as Record<
      string,
      unknown
    >;
    expect(merged.somethingElse).toBeUndefined();
  });

  it("falls back entirely when there is nothing stored", () => {
    expect(mergeContent(null)).toEqual(defaultContent);
    expect(mergeContent("not an object")).toEqual(defaultContent);
  });
});

describe("the session walkthrough survives a round trip through the dashboard", () => {
  it("is not stripped when content is saved", () => {
    // Zod drops unknown keys, so a field missing from the schema would be
    // quietly erased the first time anything else in Settings was saved.
    const parsed = siteContentSchema.parse(defaultContent);
    expect(parsed.sessionStructure).toEqual(defaultContent.sessionStructure);
  });

  it("keeps an edited walkthrough", () => {
    const edited = {
      ...defaultContent,
      sessionStructure: {
        heading: "How a first session goes",
        intro: "Short version.",
        steps: [{ title: "One", desc: "Then the other." }],
      },
    };
    const parsed = siteContentSchema.parse(edited);
    expect(parsed.sessionStructure.steps).toEqual([
      { title: "One", desc: "Then the other." },
    ]);
  });
});

describe("the intake form's opening screen is content, not code", () => {
  it("is served from the defaults for a document written before it existed", () => {
    const merged = mergeContent({ hero: { headline: "Edited" } });
    expect(merged.intakeForm.heading).toBeTruthy();
    expect(merged.intakeForm.assurances.length).toBeGreaterThan(0);
  });

  it("survives a save, so editing anything else does not erase it", () => {
    const parsed = siteContentSchema.parse(defaultContent);
    expect(parsed.intakeForm).toEqual(defaultContent.intakeForm);
  });

  it("quotes the rate with a token rather than a figure", () => {
    // The point of the token system: the rates list is the only place a price
    // is typed, so this screen cannot drift from it.
    const assurances = defaultContent.intakeForm.assurances.join(" ");
    expect(assurances).toContain("{{rate.range}}");
    expect(assurances).not.toMatch(/₹\d/);
  });

  it("resolves that token for the public site", () => {
    const resolved = resolveContentTokens({
      ...defaultContent,
      slidingScale: ["₹400 (Student)", "₹900"],
    });
    expect(resolved.intakeForm.assurances.join(" ")).toContain("₹400–₹900");
    expect(resolved.intakeForm.assurances.join(" ")).not.toContain("{{");
  });
});
