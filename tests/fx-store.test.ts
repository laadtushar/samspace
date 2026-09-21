import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  rateIsFresh,
  maxAgeFor,
  rateAgeDays,
  MAX_RATE_AGE_DAYS,
  MAX_MANUAL_RATE_AGE_DAYS,
  type FxRate,
} from "@/lib/convert";
import { rateProblem } from "@/lib/fx-store";

/**
 * The rates the practice quotes with, and how long each may be quoted for.
 *
 * There is no feed — none is reachable — so these are set by hand, and that
 * changes what staleness means. The fortnight a fetched rate gets is a check on
 * the fetcher: two weeks without an update means the mechanism is broken. A
 * typed rate two weeks old means nothing is broken at all.
 */

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

const rate = (over: Partial<FxRate> = {}): FxRate => ({
  currency: "USD",
  perRupee: 0.0115,
  asOf: daysAgo(1),
  ...over,
});

describe("how long a rate may be quoted", () => {
  it("holds a fetched rate to the fortnight", () => {
    expect(maxAgeFor(rate({ source: "feed" }))).toBe(MAX_RATE_AGE_DAYS);
    expect(rateIsFresh(rate({ source: "feed", asOf: daysAgo(13) }))).toBe(true);
    expect(rateIsFresh(rate({ source: "feed", asOf: daysAgo(15) }))).toBe(false);
  });

  it("treats a missing source as fetched, which is the stricter rule", () => {
    // Defaulting the other way would quietly grant a year to anything that
    // forgot to say where it came from.
    expect(maxAgeFor(rate())).toBe(MAX_RATE_AGE_DAYS);
  });

  it("gives a hand-set rate far longer, because nothing has failed", () => {
    /*
      The case this distinction exists for. Expiring a typed rate on the
      fetcher's timer would take a working price off the site a fortnight after
      someone set it, and give them no reason why.
    */
    expect(maxAgeFor(rate({ source: "manual" }))).toBe(MAX_MANUAL_RATE_AGE_DAYS);
    expect(rateIsFresh(rate({ source: "manual", asOf: daysAgo(60) }))).toBe(true);
    expect(rateIsFresh(rate({ source: "manual", asOf: daysAgo(200) }))).toBe(true);
  });

  it("still expires a hand-set rate eventually", () => {
    // A year-old rate quotes a figure about a world that has moved. Falling
    // back to the rupee price the practice actually bills is always safe.
    expect(
      rateIsFresh(rate({ source: "manual", asOf: daysAgo(MAX_MANUAL_RATE_AGE_DAYS + 1) }))
    ).toBe(false);
  });

  it("refuses a rate from the future, whatever its source", () => {
    // A clock problem somewhere, not a fresh rate.
    expect(rateIsFresh(rate({ source: "manual", asOf: daysAgo(-2) }))).toBe(false);
    expect(rateIsFresh(rate({ source: "feed", asOf: daysAgo(-2) }))).toBe(false);
  });

  it("refuses a rate whose timestamp cannot be read", () => {
    expect(rateAgeDays(rate({ asOf: "not a date" }))).toBeNull();
    expect(rateIsFresh(rate({ asOf: "not a date", source: "manual" }))).toBe(false);
  });
});

describe("what the dashboard will accept", () => {
  it("refuses anything that is not a currency code", () => {
    expect(rateProblem("US", 0.0115)).toMatch(/three-letter/i);
    expect(rateProblem("dollars", 0.0115)).toMatch(/three-letter/i);
    expect(rateProblem("", 0.0115)).toMatch(/three-letter/i);
  });

  it("refuses the practice's own currency", () => {
    // Converting rupees into rupees is not a conversion, and a row claiming to
    // do it would be a rate that could disagree with itself.
    expect(rateProblem("INR", 1)).toMatch(/already in INR/i);
  });

  it("refuses a rate that would price every tier at nothing", () => {
    expect(rateProblem("USD", 0)).toMatch(/positive number/i);
    expect(rateProblem("USD", -0.01)).toMatch(/positive number/i);
    expect(rateProblem("USD", "")).toMatch(/positive number/i);
    expect(rateProblem("USD", "abc")).toMatch(/positive number/i);
    expect(rateProblem("USD", undefined)).toMatch(/positive number/i);
  });

  it("accepts a real rate, including a typed one", () => {
    expect(rateProblem("USD", 0.0115)).toBe("");
    expect(rateProblem("USD", "0.0115")).toBe("");
    // The yen is more than one unit per rupee; the dinar is far less. Both are
    // ordinary, and a check that assumed "less than one" would refuse one.
    expect(rateProblem("JPY", 1.78)).toBe("");
    expect(rateProblem("KWD", 0.0035)).toBe("");
  });
});

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("rates in Postgres", () => {
  let sql: typeof import("@/lib/db").sql;
  const previousUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  afterAll(() => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  beforeEach(async () => {
    process.env.DATABASE_URL = url;
    await sql()`delete from fx_rates`;
    vi.resetModules();
  });

  it("round-trips a rate without losing precision", async () => {
    /*
      The reason the column is numeric. per_rupee spans three orders of
      magnitude across the currencies this might hold, and a rate that comes
      back as something other than what was typed prices every tier wrong.
    */
    const { saveRate, rateFor } = await import("@/lib/fx-store");
    await saveRate("KWD", 0.0035123456);

    const stored = await rateFor("KWD");
    expect(stored?.perRupee).toBe(0.0035123456);
    expect(stored?.source).toBe("manual");
  });

  it("replaces a rate rather than accumulating them", async () => {
    const { saveRate, rateFor, allRates } = await import("@/lib/fx-store");
    await saveRate("USD", 0.0115);
    await saveRate("USD", 0.0120);

    expect((await allRates()).length).toBe(1);
    expect((await rateFor("USD"))?.perRupee).toBe(0.012);
  });

  it("moves as_of forward on every save, because that is what its age means", async () => {
    const { saveRate, rateFor } = await import("@/lib/fx-store");
    await saveRate("USD", 0.0115);
    const first = await rateFor("USD");

    await new Promise((r) => setTimeout(r, 10));
    await saveRate("USD", 0.0116);
    const second = await rateFor("USD");

    expect(new Date(second!.asOf).getTime()).toBeGreaterThanOrEqual(
      new Date(first!.asOf).getTime()
    );
  });

  it("answers null for a currency with no rate", async () => {
    // Not an error — that currency is simply quoted in rupees.
    const { rateFor } = await import("@/lib/fx-store");
    expect(await rateFor("AED")).toBeNull();
  });

  it("never stores a rate for the practice's own currency", async () => {
    const { saveRate, rateFor } = await import("@/lib/fx-store");
    await expect(saveRate("INR", 1)).rejects.toThrow(/already in INR/i);
    expect(await rateFor("INR")).toBeNull();
  });

  it("refuses a non-positive rate at the database too", async () => {
    // Guarding the guard: the check in rateProblem is the friendly one, and the
    // constraint is the one that holds if anything ever writes around it.
    await expect(
      sql()`insert into fx_rates (currency, per_rupee) values ('USD', 0)`
    ).rejects.toThrow();
  });

  it("refuses something that is not a currency code at the database too", async () => {
    await expect(
      sql()`insert into fx_rates (currency, per_rupee) values ('dollars', 0.01)`
    ).rejects.toThrow();
  });

  it("removes a rate, returning that currency to rupees", async () => {
    const { saveRate, deleteRate, rateFor } = await import("@/lib/fx-store");
    await saveRate("USD", 0.0115);

    expect(await deleteRate("USD")).toBe(true);
    expect(await rateFor("USD")).toBeNull();
    // Removing one that is not there is not a failure to report as success.
    expect(await deleteRate("USD")).toBe(false);
  });
});
