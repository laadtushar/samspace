import { describe, it, expect } from "vitest";
import {
  toSection,
  anyRejectedWith,
  everyFailed,
  valueOr,
  type Section,
} from "@/lib/dashboard-load";

/**
 * One failing read must not empty the dashboard.
 *
 * The three loads were made with Promise.all, so a single rejection took the
 * whole result with it: every tab rendered empty under one banner. That is what
 * a paused storage layer looked like from the practitioner's side — the
 * clients, the sessions and the blog were all readable the whole time, and none
 * of them were shown, because the one endpoint reading the failing store
 * rejected first.
 */

const ok = <T,>(value: T): PromiseSettledResult<T> => ({
  status: "fulfilled",
  value,
});
const failed = (reason: unknown): PromiseSettledResult<never> => ({
  status: "rejected",
  reason,
});

describe("one section's outcome", () => {
  it("carries the value through when it loaded", () => {
    const section = toSection(ok([1, 2, 3]), "fallback");
    expect(section.ok).toBe(true);
    expect(section.ok && section.value).toEqual([1, 2, 3]);
  });

  it("keeps the real message, which says more than the fallback", () => {
    const section = toSection(failed(new Error("Request failed (503)")), "generic");
    expect(section.ok).toBe(false);
    expect(!section.ok && section.error).toBe("Request failed (503)");
  });

  it("falls back when the failure has nothing readable to say", () => {
    // A thrown string, a rejected undefined, an Error with an empty message —
    // all of which render as a blank red box without this.
    expect((toSection(failed("boom"), "generic") as { error: string }).error).toBe(
      "generic"
    );
    expect(
      (toSection(failed(new Error("   ")), "generic") as { error: string }).error
    ).toBe("generic");
    expect(
      (toSection(failed(undefined), "generic") as { error: string }).error
    ).toBe("generic");
  });
});

describe("what a failure means for the page", () => {
  it("treats a single failure as that section's problem alone", () => {
    /*
      The case this all exists for. Submissions fail, content and posts are
      fine — the content editor and the blog must still render, with only the
      submissions tab saying anything went wrong.
    */
    const sections: Section<unknown>[] = [
      toSection(failed(new Error("Request failed (503)")), "f"),
      toSection(ok({ content: {}, stored: true }), "f"),
      toSection(ok([{ slug: "a-post" }]), "f"),
    ];

    expect(everyFailed(sections)).toBe(false);
    expect(sections[1].ok).toBe(true);
    expect(sections[2].ok).toBe(true);
  });

  it("calls it a page failure only when nothing loaded", () => {
    const sections = [
      toSection(failed(new Error("a")), "f"),
      toSection(failed(new Error("b")), "f"),
      toSection(failed(new Error("c")), "f"),
    ];
    expect(everyFailed(sections)).toBe(true);
  });

  it("does not call an empty list a page failure", () => {
    // Nothing to show is not the same as nothing loading, and the difference
    // is the whole reason this module exists.
    expect(everyFailed([toSection(ok([]), "f")])).toBe(false);
  });

  it("says nothing failed when there is nothing to judge", () => {
    expect(everyFailed([])).toBe(false);
  });
});

describe("an expired session", () => {
  class SessionExpired extends Error {}

  it("is recognised wherever among the loads it surfaces", () => {
    /*
      An expired session fails all three requests. Signing out once is the right
      answer; three "could not load" banners over a dashboard nobody is
      authenticated for is not.
    */
    const match = (r: unknown) => r instanceof SessionExpired;

    expect(
      anyRejectedWith([ok(1), ok(2), failed(new SessionExpired())], match)
    ).toBe(true);
    expect(
      anyRejectedWith([failed(new SessionExpired()), ok(2), ok(3)], match)
    ).toBe(true);
  });

  it("is not confused with an ordinary failure", () => {
    const match = (r: unknown) => r instanceof SessionExpired;
    expect(anyRejectedWith([failed(new Error("503")), ok(1)], match)).toBe(false);
    expect(anyRejectedWith([ok(1), ok(2)], match)).toBe(false);
  });
});

describe("rendering a section that failed", () => {
  it("gives the caller an empty value rather than undefined", () => {
    // The component maps over these. Undefined would turn a failed read into a
    // crash, which is a worse outcome than the blank screen being fixed here.
    expect(valueOr(toSection(failed(new Error("x")), "f"), [])).toEqual([]);
    expect(valueOr(toSection(ok([1]), "f"), [])).toEqual([1]);
  });
});

describe("the dashboard actually uses it", () => {
  it("settles the three loads rather than racing them to one failure", async () => {
    /*
      Read as source. The bug was a single `Promise.all`, and the fix is one
      word — which is exactly the kind of change that reverts by accident in a
      later edit and shows up as "the whole dashboard is down" months on.

      The component is a client component several thousand lines long; loading
      it in a test to assert this would be a far larger apparatus than the
      thing being guarded.
    */
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("../app/admin/page.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("Promise.allSettled([");
    // The three endpoints still load together, just without a shared fate.
    expect(source).toContain('apiJson<SubmissionsResponse>("/api/admin/submissions")');
    expect(source).toContain('apiJson<BlogPost[]>("/api/admin/blog")');

    // Nothing in the file may gather those loads under a single rejection.
    const loader = source.slice(
      source.indexOf("Promise.allSettled(["),
      source.indexOf("void refreshStarterCount();")
    );
    expect(loader).not.toContain("Promise.all(");
  });

  it("still signs out on an expired session", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const source = readFileSync(
      new URL("../app/admin/page.tsx", import.meta.url),
      "utf8"
    );
    // allSettled never rejects, so the old catch would have stopped running —
    // an expired session would have shown three load errors and left the person
    // staring at a dashboard they were no longer signed in to.
    expect(source).toContain("anyRejectedWith(results, (r) => r instanceof SessionExpired)");
    expect(source).toContain("endSession();");
  });
});
