import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

/**
 * What a submission agreed to pay, recorded as a number in a named currency.
 *
 * sliding_scale holds the wording the person actually saw — "₹800", or
 * "₹500 (Student)" — and that is worth keeping, because it is what they agreed
 * to. It was also the only record of the amount, and nothing can do arithmetic
 * on it: a total, a report, or a check against what a session was billed at
 * all had to parse a string with a symbol and an optional label in it.
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("recording what was agreed", () => {
  let sql: typeof import("@/lib/db").sql;
  let recordSubmission: typeof import("@/lib/practice").recordSubmission;
  let listSubmissionsForDashboard: typeof import("@/lib/practice").listSubmissionsForDashboard;
  const previousUrl = process.env.DATABASE_URL;

  const submission = (over: Record<string, unknown> = {}) =>
    ({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      name: "Asha Rao",
      email: `asha-${crypto.randomUUID().slice(0, 8)}@example.com`,
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
    ({ sql } = await import("@/lib/db"));
    ({ recordSubmission, listSubmissionsForDashboard } = await import(
      "@/lib/practice"
    ));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  afterAll(() => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  beforeEach(async () => {
    await sql()`delete from submissions`;
    await sql()`delete from clients`;
  });

  const stored = async (id: string) =>
    (
      (await sql()`
        select sliding_scale, rate_amount, currency from submissions where id = ${id}
      `) as unknown as {
        sliding_scale: string;
        rate_amount: number | null;
        currency: string;
      }[]
    )[0];

  it("records the amount as a number beside the wording", async () => {
    const s = submission({ slidingScale: "₹800" });
    await recordSubmission(s);

    const row = await stored((s as { id: string }).id);
    expect(row.sliding_scale).toBe("₹800");
    expect(Number(row.rate_amount)).toBe(800);
    expect(row.currency).toBe("INR");
  });

  it("reads the amount out of a labelled rate", async () => {
    // The concessional tier carries its label in the same string.
    const s = submission({ slidingScale: "₹500 (Student)", studentConfirmed: true });
    await recordSubmission(s);

    const row = await stored((s as { id: string }).id);
    expect(row.sliding_scale).toBe("₹500 (Student)");
    expect(Number(row.rate_amount)).toBe(500);
  });

  it("records nothing rather than zero when the wording has no number", async () => {
    /*
      A zero would read as a session someone agreed to have for free, which is
      a different claim from "this was never recorded" and the sort of thing
      that turns up later in a total.
    */
    const s = submission({ slidingScale: "" });
    await recordSubmission(s);

    const row = await stored((s as { id: string }).id);
    expect(row.rate_amount).toBeNull();
  });

  it("defaults the currency to the one the practice bills in", async () => {
    // The intake form does not convert prices today, so every row is rupees.
    // The column says so rather than leaving it to be inferred from a date.
    const s = submission();
    await recordSubmission(s);
    expect((await stored((s as { id: string }).id)).currency).toBe("INR");
  });

  it("records a display currency when one is given", async () => {
    /*
      Nothing sets this yet. It exists so that when the form does convert, the
      record says which money the figure was read in — while the rupee amount
      stays the one that is charged.
    */
    const s = submission({ displayCurrency: "aed" });
    await recordSubmission(s);

    const row = await stored((s as { id: string }).id);
    // Upper-cased on the way in, because the constraint demands ISO 4217 and a
    // lower-case code is not a reason to lose an enquiry.
    expect(row.currency).toBe("AED");
    // The amount is still the rupees that will be billed, not a converted one.
    expect(Number(row.rate_amount)).toBe(800);
  });

  it("shows both on the dashboard", async () => {
    const s = submission({ slidingScale: "₹900" });
    await recordSubmission(s);

    const [row] = await listSubmissionsForDashboard();
    expect(row.slidingScale).toBe("₹900");
    expect(row.rateAmount).toBe(900);
    expect(row.currency).toBe("INR");
  });

  it("reads a row written before the columns existed as unrecorded", async () => {
    // Rows predating migration 009 have no amount. Null says "never recorded";
    // a zero would show a free session that never happened.
    const s = submission();
    await recordSubmission(s);
    await sql()`update submissions set rate_amount = null`;

    const [row] = await listSubmissionsForDashboard();
    expect(row.rateAmount).toBeNull();
    expect(row.currency).toBe("INR");
  });

  it("refuses a currency that is not a currency, at the database", async () => {
    // The friendly check is upstream; this is the one that holds if anything
    // ever writes around it.
    await expect(
      sql()`
        insert into submissions (id, name, email, currency)
        values (gen_random_uuid(), 'X', 'x@example.com', 'rupees')
      `
    ).rejects.toThrow();
  });

  it("refuses a negative fee, which is a broken parse rather than a discount", async () => {
    await expect(
      sql()`
        insert into submissions (id, name, email, rate_amount)
        values (gen_random_uuid(), 'X', 'x@example.com', -100)
      `
    ).rejects.toThrow();
  });
});
