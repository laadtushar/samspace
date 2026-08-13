import { describe, it, expect, beforeAll, beforeEach } from "vitest";

/**
 * Integration tests against a real Postgres.
 *
 * These exercise the SQL itself — dedupe, constraints, what a second enquiry
 * does to an existing record — because none of that can be verified by reading
 * the code. They are skipped unless TEST_DATABASE_URL is set, so a fresh clone
 * still passes; in CI a missing database is a failure rather than a skip.
 *
 * Start one locally with:
 *   pg_ctlcluster 16 main start
 *   TEST_DATABASE_URL=postgresql://…/samspace_test npx vitest run
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

/**
 * A skipped suite is indistinguishable from a passing one at a glance, so CI
 * would happily stay green while never touching a database. This turns that
 * into a failure: on CI the database must be present and answering, and the
 * proof is a query rather than the presence of a variable.
 */
describe("database tests are wired up", () => {
  it("is connected to a real database when running in CI", async () => {
    if (!process.env.CI) return;
    expect(url, "TEST_DATABASE_URL must be set in CI").toBeTruthy();

    process.env.DATABASE_URL = url;
    const { sql } = await import("@/lib/db");
    const rows = await sql()`
      select count(*)::int as n
      from information_schema.tables
      where table_schema = 'public'
    `;
    expect(Number(rows[0].n)).toBeGreaterThan(0);
  });
});

suite("recordSubmission against a real database", () => {
  let recordSubmission: typeof import("@/lib/practice").recordSubmission;
  let sql: typeof import("@/lib/db").sql;

  const submission = (over: Partial<Record<string, unknown>> = {}) =>
    ({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
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
    }) as never;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ recordSubmission } = await import("@/lib/practice"));
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  beforeEach(async () => {
    await sql()`delete from sessions`;
    await sql()`delete from submissions`;
    await sql()`delete from clients`;
  });

  it("creates a client and stores the submission", async () => {
    const s = submission();
    const clientId = await recordSubmission(s);

    const clients = await sql()`select * from clients where id = ${clientId}`;
    expect(clients).toHaveLength(1);
    expect(clients[0].name).toBe("Asha Rao");
    expect(clients[0].status).toBe("enquiry");
    expect(clients[0].age).toBe(24); // string on the form, integer in the column

    const subs = await sql()`select * from submissions where client_id = ${clientId}`;
    expect(subs).toHaveLength(1);
    expect(subs[0].concerns).toContain("Exam stress");
  });

  it("attaches a second enquiry to the same client rather than duplicating", async () => {
    const first = await recordSubmission(submission());
    const second = await recordSubmission(
      submission({ whatsapp: "8888888888" })
    );

    expect(second).toBe(first);
    expect(await sql()`select id from clients`).toHaveLength(1);
    expect(await sql()`select id from submissions`).toHaveLength(2);
  });

  it("matches on email regardless of case or surrounding space", async () => {
    const first = await recordSubmission(submission());
    const again = await recordSubmission(
      submission({ email: "  ASHA@Example.COM  " })
    );
    expect(again).toBe(first);
    expect(await sql()`select id from clients`).toHaveLength(1);
  });

  it("refreshes contact details from the newer submission", async () => {
    await recordSubmission(submission());
    await recordSubmission(submission({ whatsapp: "7777777777", age: "25" }));

    const [client] = await sql()`select * from clients`;
    expect(client.whatsapp).toBe("7777777777");
    expect(client.age).toBe(25);
  });

  it("never lets a new submission overwrite a decision the practitioner made", async () => {
    const clientId = await recordSubmission(submission());
    await sql()`
      update clients set status = 'active', agreed_rate = '₹500 (Student)'
      where id = ${clientId}
    `;

    await recordSubmission(submission({ slidingScale: "₹1000" }));

    const [client] = await sql()`select * from clients`;
    expect(client.status).toBe("active");
    expect(client.agreed_rate).toBe("₹500 (Student)");
  });

  it("is idempotent — replaying the same submission id stores it once", async () => {
    const s = submission();
    await recordSubmission(s);
    await recordSubmission(s);
    expect(await sql()`select id from submissions`).toHaveLength(1);
  });

  it("keeps the submission exactly as written when the client is corrected", async () => {
    const clientId = await recordSubmission(submission());
    await sql()`update clients set name = 'Asha R.' where id = ${clientId}`;

    const [sub] = await sql()`select * from submissions`;
    expect(sub.name).toBe("Asha Rao");
  });

  it("records the student rate when it was confirmed", async () => {
    await recordSubmission(
      submission({ slidingScale: "₹500 (Student)", studentConfirmed: true })
    );
    const [sub] = await sql()`select * from submissions`;
    const [client] = await sql()`select * from clients`;
    expect(sub.student_confirmed).toBe(true);
    expect(client.student_rate).toBe(true);
  });

  it("refuses two clients with the same email even outside this code path", async () => {
    await recordSubmission(submission());
    await expect(
      sql()`insert into clients (name, email) values ('Someone', 'ASHA@example.com')`
    ).rejects.toThrow();
  });

  it("removes a client's sessions with them, but leaves the submission", async () => {
    const clientId = await recordSubmission(submission());
    await sql()`
      insert into sessions (client_id, starts_at, ends_at)
      values (${clientId}, now(), now() + interval '50 minutes')
    `;

    await sql()`delete from clients where id = ${clientId}`;

    expect(await sql()`select id from sessions`).toHaveLength(0);
    const subs = await sql()`select * from submissions`;
    expect(subs).toHaveLength(1);
    expect(subs[0].client_id).toBeNull(); // detached, not destroyed
  });
});
