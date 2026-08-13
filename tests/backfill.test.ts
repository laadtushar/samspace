import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

/**
 * The maintenance action, exercised for real.
 *
 * This is the code that copies existing submissions into the database, and it
 * is the one thing on the dashboard aimed at records that already exist. Blob
 * storage is stubbed — there is no token here, and the point is not to test
 * Vercel's client but the loop that reads from it and writes to Postgres.
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const legacy = vi.fn();
const submissions = vi.fn();

vi.mock("@/lib/admin-guard", () => ({ requireAdmin: () => null }));

vi.mock("@/lib/content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content")>();
  return {
    ...actual,
    migrateLegacySubmissions: () => legacy(),
    getSubmissions: () => submissions(),
  };
});

suite("the maintenance backfill", () => {
  let POST: typeof import("@/app/api/admin/migrate/route").POST;
  let sql: typeof import("@/lib/db").sql;

  const stored = (over: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    name: "Asha Rao",
    email: "asha@example.com",
    gender: "Female",
    age: "24",
    whatsapp: "9999999999",
    education: "MA Psychology",
    preferredLanguage: "English",
    concerns: "Exam stress.",
    slidingScale: "₹800",
    studentConfirmed: false,
    scheduling: "",
    ...over,
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
    ({ POST } = await import("@/app/api/admin/migrate/route"));
  });

  beforeEach(async () => {
    await sql()`delete from sessions`;
    await sql()`delete from submissions`;
    await sql()`delete from clients`;
    legacy.mockReset().mockResolvedValue({ migrated: 0 });
    submissions.mockReset().mockResolvedValue([]);
  });

  it("copies stored submissions into the database", async () => {
    submissions.mockResolvedValue([
      stored({ email: "asha@example.com" }),
      stored({ email: "rohan@example.com", name: "Rohan Mehta" }),
    ]);

    const body = await (await POST()).json();

    expect(body.success).toBe(true);
    expect(body.backfilled).toBe(2);
    expect(body.failed).toBe(0);
    expect(await sql()`select id from submissions`).toHaveLength(2);
    expect(await sql()`select id from clients`).toHaveLength(2);
  });

  it("is safe to run twice — the second run adds nothing", async () => {
    submissions.mockResolvedValue([stored()]);

    await POST();
    await POST();

    expect(await sql()`select id from submissions`).toHaveLength(1);
    expect(await sql()`select id from clients`).toHaveLength(1);
  });

  it("groups repeat enquiries from one person onto a single client", async () => {
    submissions.mockResolvedValue([
      stored({ concerns: "first" }),
      stored({ concerns: "second" }),
    ]);

    await POST();

    expect(await sql()`select id from submissions`).toHaveLength(2);
    expect(await sql()`select id from clients`).toHaveLength(1);
  });

  it("keeps going when one record cannot be copied, and reports it", async () => {
    submissions.mockResolvedValue([
      stored({ email: "good@example.com" }),
      // No email: the clients table requires one, so this row must fail.
      stored({ email: "", name: "Broken" }),
      stored({ email: "alsogood@example.com" }),
    ]);

    const body = await (await POST()).json();

    expect(body.backfilled).toBe(2);
    expect(body.failed).toBe(1);
    expect(await sql()`select id from clients`).toHaveLength(2);
  });

  it("still moves records out of public storage when there is nothing to copy", async () => {
    legacy.mockResolvedValue({ migrated: 3 });
    const body = await (await POST()).json();
    expect(body.migrated).toBe(3);
    expect(body.message).toContain("public storage");
  });

  it("says what happened rather than just succeeding", async () => {
    submissions.mockResolvedValue([stored()]);
    const body = await (await POST()).json();
    expect(body.message).toMatch(/1 submission\(s\) now in the database/);
  });
});
