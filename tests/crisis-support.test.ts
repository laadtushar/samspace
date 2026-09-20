import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { defaultContent } from "@/lib/default-content";
import { siteContentSchema } from "@/lib/validation";
import { mergeContent } from "@/lib/content";

/**
 * The crisis notice and the numbers under it.
 *
 * This is the most consequential text on the site — what someone reads on the
 * worst day they will spend here — and it was written into a component, so a
 * helpline that changed its number needed a deployment to correct. It is content
 * now, which means it can also be edited into a worse state, so these are the
 * guards on what "worse" is allowed to reach.
 */
const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("crisis support", () => {
  it("ships the numbers that were on the page", () => {
    // Unchanged in the move. Which services to name is a clinical decision.
    expect(defaultContent.crisis.helplines).toEqual([
      { name: "iCall", number: "9152987821", note: "" },
      { name: "Vandrevala Foundation", number: "1860-2662-345", note: "24/7" },
    ]);
    expect(defaultContent.crisis.notice).toContain("not crisis or emergency care");
  });

  it("survives a content document written before the field existed", () => {
    // mergeContent spreads the defaults underneath stored content, which is what
    // lets a new section reach the live site at all.
    const stored = { hero: { headline: "Edited" } };
    expect(mergeContent(stored).crisis).toEqual(defaultContent.crisis);
  });

  it("refuses half a helpline", () => {
    for (const helpline of [
      { name: "iCall", number: "", note: "" },
      { name: "", number: "9152987821", note: "" },
      { name: "   ", number: "9152987821", note: "" },
    ]) {
      const result = siteContentSchema.safeParse({
        ...defaultContent,
        crisis: { ...defaultContent.crisis, helplines: [helpline] },
      });
      // Help that exists and cannot be reached is worse than one fewer number.
      expect(result.success, JSON.stringify(helpline)).toBe(false);
    }
  });

  it("accepts a number written the way a person reads it back", () => {
    const result = siteContentSchema.safeParse({
      ...defaultContent,
      crisis: {
        ...defaultContent.crisis,
        helplines: [{ name: "Tele-MANAS", number: "14416", note: "24/7" }],
      },
    });
    expect(result.success).toBe(true);
  });

  it("keeps the numbers on the page when content does not arrive", () => {
    const component = read("components/SessionInfo.tsx");
    // The one section that must not be able to render empty: a storage failure
    // has to leave the numbers up, not take them down.
    expect(component).toContain("FALLBACK_CRISIS");
    for (const number of ["9152987821", "1860-2662-345"]) {
      expect(component, number).toContain(number);
    }
  });

  it("offers every helpline as something to tap", () => {
    const component = read("components/SessionInfo.tsx");
    // On a phone, in the moment this text is for, reading a number off the
    // screen and typing it is a step too many.
    expect(component).toContain("href={`tel:");
  });

  it("no longer keeps a second copy of the numbers in the component", () => {
    const component = read("components/SessionInfo.tsx");
    // Present once, as the fallback — not a second time in the markup.
    const occurrences = component.split("9152987821").length - 1;
    expect(occurrences).toBe(1);
  });
});
