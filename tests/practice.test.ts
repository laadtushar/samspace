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
 * into a failure.
 *
 * It asserts only that a database answers — deliberately not that any table
 * exists. The first version counted tables and broke CI, because the database
 * there is created empty and this runs before the suite below applies the
 * migration. Whether the schema is correct is what the other tests are for; all
 * this one needs to establish is that something real is on the other end.
 */
describe("database tests are wired up", () => {
  it("is connected to a real database when running in CI", async () => {
    if (!process.env.CI) return;
    expect(url, "TEST_DATABASE_URL must be set in CI").toBeTruthy();

    process.env.DATABASE_URL = url;
    const { sql } = await import("@/lib/db");
    const rows = await sql()`select 1 as ok`;
    expect(Number(rows[0].ok)).toBe(1);
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

suite("the client list and the fields a practitioner owns", () => {
  let practice: typeof import("@/lib/practice");
  let sql: typeof import("@/lib/db").sql;

  const submission = (over: Record<string, unknown> = {}) =>
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
      concerns: "Exam stress.",
      slidingScale: "₹800",
      studentConfirmed: false,
      scheduling: "",
      ...over,
    }) as never;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    practice = await import("@/lib/practice");
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  beforeEach(async () => {
    await sql()`delete from sessions`;
    await sql()`delete from submissions`;
    await sql()`delete from clients`;
  });

  it("lists people newest first, with how often each has been in touch", async () => {
    await practice.recordSubmission(submission({ email: "first@example.com" }));
    const repeatId = await practice.recordSubmission(
      submission({ email: "second@example.com" })
    );
    await practice.recordSubmission(submission({ email: "second@example.com" }));

    const clients = await practice.listClients();
    expect(clients).toHaveLength(2);
    expect(clients[0].email).toBe("second@example.com"); // newest first
    expect(clients[0].id).toBe(repeatId);
    expect(clients[0].submission_count).toBe(2);
    expect(clients[1].submission_count).toBe(1);
  });

  it("returns one person's submissions, most recent first", async () => {
    const clientId = await practice.recordSubmission(
      submission({ concerns: "First time writing in." })
    );
    await practice.recordSubmission(submission({ concerns: "Following up." }));

    const subs = await practice.clientSubmissions(clientId);
    expect(subs).toHaveLength(2);
    expect(subs[0].concerns).toBe("Following up.");
  });

  it("saves status, rate and note", async () => {
    const id = await practice.recordSubmission(submission());
    const updated = await practice.updateClient(id, {
      status: "active",
      agreed_rate: "₹800",
      admin_note: "Prefers evenings.",
    });

    expect(updated?.status).toBe("active");
    expect(updated?.agreed_rate).toBe("₹800");
    expect(updated?.admin_note).toBe("Prefers evenings.");
  });

  it("leaves untouched fields alone when only one is changed", async () => {
    const id = await practice.recordSubmission(submission());
    await practice.updateClient(id, { admin_note: "Wants Hindi sessions." });
    const after = await practice.updateClient(id, { status: "active" });

    expect(after?.admin_note).toBe("Wants Hindi sessions.");
    expect(after?.status).toBe("active");
  });

  it("refuses a status that is not one of the four", async () => {
    const id = await practice.recordSubmission(submission());
    await expect(
      practice.updateClient(id, { status: "deleted" })
    ).rejects.toThrow(/Unknown status/);
  });

  it("reports honestly when the client does not exist", async () => {
    expect(
      await practice.updateClient(crypto.randomUUID(), { status: "active" })
    ).toBeNull();
  });

  it("moves updated_at forward so a change is visible as recent", async () => {
    const id = await practice.recordSubmission(submission());
    const [before] = (await sql()`select updated_at from clients where id = ${id}`) as {
      updated_at: string;
    }[];
    await new Promise((r) => setTimeout(r, 15));
    const after = await practice.updateClient(id, { status: "active" });
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
      new Date(before.updated_at).getTime()
    );
  });
});

suite("sessions", () => {
  let practice: typeof import("@/lib/practice");
  let sql: typeof import("@/lib/db").sql;
  let clientId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    practice = await import("@/lib/practice");
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  beforeEach(async () => {
    await sql()`delete from sessions`;
    await sql()`delete from submissions`;
    await sql()`delete from clients`;
    const rows = (await sql()`
      insert into clients (name, email) values ('Asha Rao', 'asha@example.com')
      returning id
    `) as { id: string }[];
    clientId = rows[0].id;
  });

  it("derives the end time from the standard session length", async () => {
    const s = await practice.createSession({
      clientId,
      startsAt: "2026-09-01T10:00:00.000Z",
    });
    const minutes =
      (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000;
    expect(minutes).toBe(practice.SESSION_MINUTES);
    expect(s.status).toBe("scheduled");
    expect(s.paid).toBe(false);
  });

  it("honours an explicit length", async () => {
    const s = await practice.createSession({
      clientId,
      startsAt: "2026-09-01T10:00:00.000Z",
      minutes: 90,
    });
    const minutes =
      (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000;
    expect(minutes).toBe(90);
  });

  it("refuses a date it cannot understand", async () => {
    await expect(
      practice.createSession({ clientId, startsAt: "next tuesday-ish" })
    ).rejects.toThrow(/valid date/);
  });

  it("lists what is still to come, soonest first", async () => {
    const soon = new Date(Date.now() + 2 * 86400_000).toISOString();
    const later = new Date(Date.now() + 9 * 86400_000).toISOString();
    await practice.createSession({ clientId, startsAt: later });
    await practice.createSession({ clientId, startsAt: soon });

    const list = await practice.listSessions();
    expect(list).toHaveLength(2);
    expect(new Date(list[0].starts_at).getTime()).toBeLessThan(
      new Date(list[1].starts_at).getTime()
    );
    expect(list[0].client_name).toBe("Asha Rao");
  });

  it("keeps recent sessions visible so attendance can be marked afterwards", async () => {
    await practice.createSession({
      clientId,
      startsAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    });
    expect(await practice.listSessions()).toHaveLength(1);
  });

  it("drops sessions older than the tail", async () => {
    await practice.createSession({
      clientId,
      startsAt: new Date(Date.now() - 60 * 86400_000).toISOString(),
    });
    expect(await practice.listSessions()).toHaveLength(0);
  });

  it("records attendance and payment", async () => {
    const s = await practice.createSession({
      clientId,
      startsAt: new Date().toISOString(),
    });
    const done = await practice.updateSession(s.id, {
      status: "completed",
      paid: true,
      rate_amount: 800,
    });
    expect(done?.status).toBe("completed");
    expect(done?.paid).toBe(true);
    expect(done?.rate_amount).toBe(800);
  });

  it("can mark a session unpaid again — coalesce must not swallow false", async () => {
    const s = await practice.createSession({
      clientId,
      startsAt: new Date().toISOString(),
    });
    await practice.updateSession(s.id, { paid: true });
    const back = await practice.updateSession(s.id, { paid: false });
    expect(back?.paid).toBe(false);
  });

  it("refuses a status outside the four", async () => {
    const s = await practice.createSession({
      clientId,
      startsAt: new Date().toISOString(),
    });
    await expect(
      practice.updateSession(s.id, { status: "rescheduled" })
    ).rejects.toThrow(/Unknown status/);
  });

  it("removes a session and reports honestly when there is none", async () => {
    const s = await practice.createSession({
      clientId,
      startsAt: new Date().toISOString(),
    });
    expect(await practice.deleteSession(s.id)).toBe(true);
    expect(await practice.deleteSession(s.id)).toBe(false);
  });

  it("lists one client's sessions newest first", async () => {
    await practice.createSession({ clientId, startsAt: "2026-09-01T10:00:00Z" });
    await practice.createSession({ clientId, startsAt: "2026-10-01T10:00:00Z" });
    const list = await practice.clientSessions(clientId);
    expect(new Date(list[0].starts_at).getTime()).toBeGreaterThan(
      new Date(list[1].starts_at).getTime()
    );
  });
});

suite("double-booking", () => {
  let practice: typeof import("@/lib/practice");
  let sql: typeof import("@/lib/db").sql;
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    practice = await import("@/lib/practice");
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  beforeEach(async () => {
    await sql()`delete from sessions`;
    await sql()`delete from clients`;
    const rows = (await sql()`
      insert into clients (name, email) values
        ('Asha Rao', 'asha@example.com'), ('Rohan Mehta', 'rohan@example.com')
      returning id
    `) as { id: string }[];
    [a, b] = rows.map((r) => r.id);
  });

  const at = "2026-09-15T10:00:00.000Z";

  it("refuses a second session at the same time", async () => {
    await practice.createSession({ clientId: a, startsAt: at });
    await expect(
      practice.createSession({ clientId: b, startsAt: at })
    ).rejects.toBeInstanceOf(practice.SessionClash);
  });

  it("refuses one that starts inside another", async () => {
    await practice.createSession({ clientId: a, startsAt: at });
    await expect(
      practice.createSession({ clientId: b, startsAt: "2026-09-15T10:30:00.000Z" })
    ).rejects.toThrow(/Overlaps/);
  });

  it("refuses one that ends inside another", async () => {
    await practice.createSession({ clientId: a, startsAt: at });
    await expect(
      practice.createSession({ clientId: b, startsAt: "2026-09-15T09:20:00.000Z" })
    ).rejects.toThrow(/Overlaps/);
  });

  it("allows one that starts exactly when the other ends", async () => {
    await practice.createSession({ clientId: a, startsAt: at });
    const next = await practice.createSession({
      clientId: b,
      startsAt: "2026-09-15T10:50:00.000Z",
    });
    expect(next.id).toBeTruthy();
  });

  it("names who the clash is with, so the message is useful", async () => {
    await practice.createSession({ clientId: a, startsAt: at });
    await expect(
      practice.createSession({ clientId: b, startsAt: at })
    ).rejects.toMatchObject({ clientName: "Asha Rao" });
  });

  it("lets a cancelled slot be rebooked", async () => {
    const first = await practice.createSession({ clientId: a, startsAt: at });
    await practice.updateSession(first.id, { status: "cancelled" });
    const replacement = await practice.createSession({ clientId: b, startsAt: at });
    expect(replacement.id).toBeTruthy();
  });
});

suite("the dashboard reads submissions from the database", () => {
  let practice: typeof import("@/lib/practice");
  let sql: typeof import("@/lib/db").sql;

  const submission = (over: Record<string, unknown> = {}) =>
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
      concerns: "Exam stress.",
      slidingScale: "₹800",
      studentConfirmed: false,
      scheduling: "",
      ...over,
    }) as never;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    practice = await import("@/lib/practice");
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  beforeEach(async () => {
    await sql()`delete from sessions`;
    await sql()`delete from submissions`;
    await sql()`delete from clients`;
  });

  it("returns the same shape the dashboard already renders", async () => {
    await practice.recordSubmission(submission());
    const [row] = await practice.listSubmissionsForDashboard();

    expect(row.name).toBe("Asha Rao");
    expect(row.email).toBe("asha@example.com");
    expect(row.age).toBe("24"); // string, as the form and the CSV expect
    expect(row.preferredLanguage).toBe("English");
    expect(row.slidingScale).toBe("₹800");
    expect(row.studentConfirmed).toBe(false);
    expect(row.clientId).toBeTruthy();
    expect(() => new Date(row.timestamp).toISOString()).not.toThrow();
  });

  it("orders newest first", async () => {
    await practice.recordSubmission(
      submission({ email: "a@example.com", concerns: "older" })
    );
    await new Promise((r) => setTimeout(r, 10));
    await practice.recordSubmission(
      submission({ email: "b@example.com", concerns: "newer" })
    );

    const rows = await practice.listSubmissionsForDashboard();
    expect(rows[0].concerns).toBe("newer");
  });

  it("carries the student confirmation through", async () => {
    await practice.recordSubmission(
      submission({ slidingScale: "₹500 (Student)", studentConfirmed: true })
    );
    const [row] = await practice.listSubmissionsForDashboard();
    expect(row.studentConfirmed).toBe(true);
  });

  it("deletes a submission and says so honestly the second time", async () => {
    await practice.recordSubmission(submission());
    const [row] = await practice.listSubmissionsForDashboard();
    expect(await practice.deleteSubmissionRow(row.id)).toBe(true);
    expect(await practice.deleteSubmissionRow(row.id)).toBe(false);
    expect(await practice.listSubmissionsForDashboard()).toHaveLength(0);
  });

  it("leaves the client behind when their submission is deleted", async () => {
    await practice.recordSubmission(submission());
    const [row] = await practice.listSubmissionsForDashboard();
    await practice.deleteSubmissionRow(row.id);
    expect(await practice.listClients()).toHaveLength(1);
  });

  it("backfilling the same records twice does not duplicate them", async () => {
    const one = submission();
    await practice.recordSubmission(one);
    await practice.recordSubmission(one);
    expect(await practice.listSubmissionsForDashboard()).toHaveLength(1);
    expect(await practice.listClients()).toHaveLength(1);
  });
});
