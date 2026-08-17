import { describe, it, expect } from "vitest";
import {
  mergeSubmissions,
  withTimeout,
  STORE_TIMEOUT_MS,
  type ViewSubmission,
} from "@/lib/submissions-view";
import type { IntakeSubmission } from "@/lib/content";

/**
 * The merge that keeps the dashboard honest.
 *
 * A submission is written to blob storage and then to the database, and the
 * second write is allowed to fail so a bad database cannot cost someone their
 * enquiry. Reading only the database spent that safety: the record survived and
 * never appeared, so nobody replied. These tests pin the rule that replaces it —
 * the screen can never show fewer records than were stored.
 */

const archived = (over: Partial<IntakeSubmission> = {}): IntakeSubmission => ({
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
  studentConfirmed: false,
  scheduling: "",
  ...over,
});

const stored = (over: Partial<ViewSubmission> = {}): ViewSubmission => ({
  ...(archived() as unknown as ViewSubmission),
  studentConfirmed: false,
  scheduling: "",
  clientId: "c0000000-0000-0000-0000-000000000000",
  ...over,
});

describe("merging the two stores", () => {
  it("shows a record the database never received", () => {
    // The exact failure: the blob write succeeded, the database write was
    // swallowed as non-fatal, and the old code showed the database alone.
    const view = mergeSubmissions([], [archived({ id: "only-in-archive" })]);

    expect(view.submissions).toHaveLength(1);
    expect(view.submissions[0].id).toBe("only-in-archive");
    expect(view.unavailable).toEqual([]);
  });

  it("shows a record that exists only in the database", () => {
    const view = mergeSubmissions([stored({ id: "only-in-db" })], []);
    expect(view.submissions.map((s) => s.id)).toEqual(["only-in-db"]);
  });

  it("shows a record held in both exactly once", () => {
    const view = mergeSubmissions([stored()], [archived()]);
    expect(view.submissions).toHaveLength(1);
  });

  it("keeps the client link, which only the database has", () => {
    const view = mergeSubmissions([stored()], [archived()]);
    expect(view.submissions[0].clientId).toBe("c0000000-0000-0000-0000-000000000000");
  });

  it("leaves an archive-only record unlinked rather than inventing a client", () => {
    const view = mergeSubmissions([], [archived()]);
    expect(view.submissions[0].clientId).toBeNull();
  });

  it("orders newest first across both stores", () => {
    const view = mergeSubmissions(
      [stored({ id: "middle", timestamp: "2026-08-11T09:00:00.000Z" })],
      [
        archived({ id: "oldest", timestamp: "2026-08-01T09:00:00.000Z" }),
        archived({ id: "newest", timestamp: "2026-08-20T09:00:00.000Z" }),
      ]
    );
    expect(view.submissions.map((s) => s.id)).toEqual(["newest", "middle", "oldest"]);
  });
});

describe("when the two copies disagree", () => {
  it("prefers the database, which is what the practitioner's edits hang off", () => {
    const view = mergeSubmissions(
      [stored({ name: "Asha Rao-Mehta" })],
      [archived({ name: "Asha Rao" })]
    );
    expect(view.submissions[0].name).toBe("Asha Rao-Mehta");
  });

  it("falls back to the archive for a field the database has blank", () => {
    // The blank-email merge bug put rows in with empty fields. Showing the
    // value that exists somewhere beats showing nothing.
    const view = mergeSubmissions(
      [stored({ email: "", concerns: "" })],
      [archived({ email: "asha@example.com", concerns: "Exam stress." })]
    );
    expect(view.submissions[0].email).toBe("asha@example.com");
    expect(view.submissions[0].concerns).toBe("Exam stress.");
  });

  it("treats whitespace as blank, not as a value", () => {
    const view = mergeSubmissions(
      [stored({ whatsapp: "   " })],
      [archived({ whatsapp: "9999999999" })]
    );
    expect(view.submissions[0].whatsapp).toBe("9999999999");
  });

  it("keeps a student confirmation recorded in either copy", () => {
    expect(
      mergeSubmissions([stored({ studentConfirmed: false })], [archived({ studentConfirmed: true })])
        .submissions[0].studentConfirmed
    ).toBe(true);
    expect(
      mergeSubmissions([stored({ studentConfirmed: true })], [archived({ studentConfirmed: false })])
        .submissions[0].studentConfirmed
    ).toBe(true);
  });
});

describe("when a store cannot be read", () => {
  it("still shows what the other one had, and says which is missing", () => {
    const view = mergeSubmissions(null, [archived()]);
    expect(view.submissions).toHaveLength(1);
    expect(view.unavailable).toEqual(["database"]);
  });

  it("survives the archive being unreachable", () => {
    const view = mergeSubmissions([stored()], null);
    expect(view.submissions).toHaveLength(1);
    expect(view.unavailable).toEqual(["archive"]);
  });

  it("distinguishes an unreadable store from an empty one", () => {
    // The distinction is the whole point: empty means nobody wrote in, null
    // means we do not know. Reporting them the same way is how a short list
    // gets mistaken for a quiet week.
    expect(mergeSubmissions([], []).unavailable).toEqual([]);
    expect(mergeSubmissions(null, null).unavailable).toEqual(["database", "archive"]);
  });
});

describe("defensive handling", () => {
  it("skips records with no id rather than collapsing them together", () => {
    const view = mergeSubmissions(
      [],
      [archived({ id: "" }), archived({ id: "real" })]
    );
    expect(view.submissions.map((s) => s.id)).toEqual(["real"]);
  });

  it("fills missing optional fields rather than emitting undefined", () => {
    const sparse = {
      id: "sparse",
      timestamp: "2026-08-10T09:00:00.000Z",
      name: "Someone",
      email: "someone@example.com",
      gender: "",
      age: "",
      whatsapp: "",
      education: "",
      preferredLanguage: "",
      concerns: "",
      slidingScale: "",
    } as IntakeSubmission;

    const [only] = mergeSubmissions([], [sparse]).submissions;
    expect(only.studentConfirmed).toBe(false);
    expect(only.scheduling).toBe("");
    expect(Object.values(only).every((v) => v !== undefined)).toBe(true);
  });

  it("handles both stores being empty", () => {
    expect(mergeSubmissions([], []).submissions).toEqual([]);
  });
});

describe("a store that hangs rather than fails", () => {
  it("gives up at the deadline and reports the store as unavailable", async () => {
    // Observed for real: the blob client retries an unreachable host instead of
    // erroring, so the request hung until the platform killed it. A short list
    // that says it is short beats a spinner that never resolves.
    const hangs = new Promise<never>(() => {});
    const started = Date.now();

    const result = await withTimeout(hangs, 50);

    expect(result).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("passes a value straight through when the store answers in time", async () => {
    expect(await withTimeout(Promise.resolve(["ok"]), 1000)).toEqual(["ok"]);
  });

  it("treats a rejection the same as a timeout", async () => {
    expect(await withTimeout(Promise.reject(new Error("down")), 1000)).toBeNull();
  });

  it("does not mistake an empty answer for a failure", async () => {
    // [] is a real answer meaning "nothing here"; null means "we do not know".
    expect(await withTimeout(Promise.resolve([]), 1000)).toEqual([]);
  });

  it("allows a slow but working store to finish", async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve(["late"]), 30));
    expect(await withTimeout(slow, 500)).toEqual(["late"]);
  });

  it("keeps the deadline generous enough for a real read", () => {
    // Under the platform's own limit, comfortably over what either store needs.
    expect(STORE_TIMEOUT_MS).toBeGreaterThanOrEqual(3000);
    expect(STORE_TIMEOUT_MS).toBeLessThan(10_000);
  });
});
