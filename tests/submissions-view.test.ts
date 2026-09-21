import { describe, it, expect } from "vitest";
import {
  submissionsView,
  withTimeout,
  STORE_TIMEOUT_MS,
  type ViewSubmission,
} from "@/lib/submissions-view";

/**
 * The rule that keeps the dashboard honest.
 *
 * This module used to merge two stores, because a submission was written to the
 * blob archive and then to the database and either write could be the one that
 * survived. Blob is gone and there is one list now — but the rule the merging
 * existed to keep is the same, and is the thing worth testing: the screen must
 * never show fewer records than were stored without saying so. A short list
 * that looks complete is the failure; the missing rows are only the symptom.
 */

const stored = (over: Partial<ViewSubmission> = {}): ViewSubmission => ({
  id: "11111111-1111-1111-1111-111111111111",
  timestamp: "2026-08-10T09:00:00.000Z",
  name: "Asha Rao",
  email: "asha@example.com",
  gender: "Female",
  age: "24",
  whatsapp: "9999999999",
  education: "MA Psychology",
  preferredLanguage: "English",
  concerns: "Exam stress that will not switch off.",
  slidingScale: "₹800",
  rateAmount: 800,
  currency: "INR",
  studentConfirmed: false,
  scheduling: "",
  clientId: "c0000000-0000-0000-0000-000000000000",
  ...over,
});

describe("building the view", () => {
  it("passes stored records through", () => {
    const view = submissionsView([stored({ id: "a" })]);
    expect(view.submissions.map((s) => s.id)).toEqual(["a"]);
    expect(view.unavailable).toEqual([]);
  });

  it("orders newest first, whatever order the rows arrive in", () => {
    const view = submissionsView([
      stored({ id: "older", timestamp: "2026-08-01T09:00:00.000Z" }),
      stored({ id: "newest", timestamp: "2026-09-01T09:00:00.000Z" }),
      stored({ id: "middle", timestamp: "2026-08-20T09:00:00.000Z" }),
    ]);
    expect(view.submissions.map((s) => s.id)).toEqual([
      "newest",
      "middle",
      "older",
    ]);
  });

  it("treats an empty list as genuinely empty", () => {
    // Nobody has written in. That is a fact, not a failure, and the dashboard
    // should say "no submissions yet" rather than warn about a store.
    const view = submissionsView([]);
    expect(view.submissions).toEqual([]);
    expect(view.unavailable).toEqual([]);
  });

  it("reports a failed read instead of rendering it as nothing", () => {
    /*
      The distinction the whole module turns on. Null is "this could not be
      read"; an empty array is "there is nothing here". Collapsing them shows a
      confident blank screen to someone whose enquiries are sitting in a store
      that happened to be down.
    */
    const view = submissionsView(null);
    expect(view.submissions).toEqual([]);
    expect(view.unavailable).toEqual(["database"]);
  });

  it("drops a row with no id rather than rendering a broken one", () => {
    const view = submissionsView([
      stored({ id: "real" }),
      { ...stored(), id: "" },
    ]);
    expect(view.submissions.map((s) => s.id)).toEqual(["real"]);
  });
});

describe("a store that hangs is a store that failed", () => {
  it("resolves to null rather than waiting", async () => {
    // On Hobby the platform kills the function at ten seconds. A hung read
    // would spend that budget and render nothing at all.
    const never = new Promise<string[]>(() => {});
    expect(await withTimeout(never, 10)).toBeNull();
  });

  it("passes a value through when it arrives in time", async () => {
    expect(await withTimeout(Promise.resolve(["ok"]), 1000)).toEqual(["ok"]);
  });

  it("treats a rejection the same as a timeout", async () => {
    // Both mean the same thing to the caller: not to be trusted as complete.
    expect(await withTimeout(Promise.reject(new Error("down")), 1000)).toBeNull();
  });

  it("leaves room to render inside the platform's limit", () => {
    expect(STORE_TIMEOUT_MS).toBeLessThan(10_000);
  });
});
