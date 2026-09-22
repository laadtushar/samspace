import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

/**
 * Country settings as they are actually stored.
 *
 * The pure rules are tested elsewhere; what matters here is that a decision
 * survives a round trip through Postgres, that the table refuses what the
 * validation refuses, and that a country nobody has touched reads as rupees.
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("storing what a country is charged", () => {
  let store: typeof import("@/lib/country-store");
  let sql: typeof import("@/lib/db").sql;
  const previousUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
    store = await import("@/lib/country-store");
  });

  afterAll(() => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  beforeEach(async () => {
    await sql()`delete from country_pricing`;
    await store.saveDefaultMarkup(0);
  });

  it("reads nothing for a country nobody has decided about", async () => {
    expect(await store.ruleFor("AE")).toBeNull();
  });

  it("round-trips a decision", async () => {
    await store.saveCountryRule({
      country: "AE",
      enabled: true,
      markupPercent: 50,
      overrideScale: null,
    });

    const stored = await store.ruleFor("AE");
    expect(stored).toEqual({
      country: "AE",
      enabled: true,
      markupPercent: 50,
      overrideScale: null,
    });
  });

  it("stores no markup as null, not as nought", async () => {
    // The two are different instructions and the column has to keep them
    // apart: null takes the common markup, 0 refuses it.
    await store.saveCountryRule({ country: "AE", enabled: true });
    expect((await store.ruleFor("AE"))!.markupPercent).toBeNull();
  });

  it("stores a deliberate nought as a nought", async () => {
    await store.saveCountryRule({ country: "AE", enabled: true, markupPercent: 0 });
    expect((await store.ruleFor("AE"))!.markupPercent).toBe(0);
  });

  it("round-trips an override, which is a list of rates", async () => {
    await store.saveCountryRule({
      country: "ae",
      enabled: true,
      markupPercent: 0,
      overrideScale: ["₹1200", "₹1400"],
    });
    const stored = await store.ruleFor("AE");
    expect(stored!.overrideScale).toEqual(["₹1200", "₹1400"]);
  });

  it("takes a lower-case country code and stores it as one code", async () => {
    // The geo header arrives upper case; a lower-case row would never match it
    // and would look configured while doing nothing.
    await store.saveCountryRule({ country: "gb", enabled: true });
    expect((await store.ruleFor("GB"))!.country).toBe("GB");
    expect(await store.allCountryRules()).toHaveLength(1);
  });

  it("replaces a country's decision rather than accumulating rows", async () => {
    await store.saveCountryRule({ country: "AE", enabled: true, markupPercent: 50 });
    await store.saveCountryRule({ country: "AE", enabled: false, markupPercent: 0 });

    const all = await store.allCountryRules();
    expect(all).toHaveLength(1);
    expect(all[0].enabled).toBe(false);
    expect(all[0].markupPercent).toBe(0);
  });

  it("refuses what the validation refuses, before it reaches the table", async () => {
    await expect(
      store.saveCountryRule({ country: "ARE", enabled: true })
    ).rejects.toThrow();
    await expect(
      store.saveCountryRule({ country: "AE", markupPercent: -5 })
    ).rejects.toThrow();
    await expect(
      store.saveCountryRule({ country: "AE", markupPercent: 9999 })
    ).rejects.toThrow();
    expect(await store.allCountryRules()).toHaveLength(0);
  });

  it("lists enabled countries first, so the dashboard reads usefully", async () => {
    await store.saveCountryRule({ country: "ZA", enabled: false });
    await store.saveCountryRule({ country: "AE", enabled: false });
    await store.saveCountryRule({ country: "US", enabled: true });

    expect((await store.allCountryRules()).map((r) => r.country)).toEqual([
      "US", "AE", "ZA",
    ]);
  });

  it("removes a country, which puts it back to rupees", async () => {
    await store.saveCountryRule({ country: "AE", enabled: true });
    expect(await store.deleteCountryRule("ae")).toBe(true);
    expect(await store.ruleFor("AE")).toBeNull();
    expect(await store.deleteCountryRule("AE")).toBe(false);
  });

  it("keeps a common markup and reads it back as a number", async () => {
    expect(await store.defaultMarkup()).toBe(0);
    expect(await store.saveDefaultMarkup(37.5)).toBe(37.5);
    expect(await store.defaultMarkup()).toBe(37.5);
  });

  it("never grows a second settings row, however often it is saved", async () => {
    await store.saveDefaultMarkup(10);
    await store.saveDefaultMarkup(20);
    const rows = (await sql()`select count(*)::int as n from pricing_settings`) as unknown as { n: number }[];
    expect(rows[0].n).toBe(1);
    expect(await store.defaultMarkup()).toBe(20);
  });

  it("refuses a common markup that is not one", async () => {
    await expect(store.saveDefaultMarkup(-5)).rejects.toThrow();
    await expect(store.saveDefaultMarkup(9999)).rejects.toThrow();
    // And leaves the stored value alone.
    expect(await store.defaultMarkup()).toBe(0);
  });

  it("reads a markup stored as numeric back as a number", async () => {
    // pg returns numeric as a string, deliberately. A markup that stayed a
    // string would multiply as NaN and price every tier at nothing.
    await sql()`
      insert into country_pricing (country, enabled, markup_percent)
      values ('QA', true, 12.5)
    `;
    const stored = await store.ruleFor("QA");
    expect(stored!.markupPercent).toBe(12.5);
  });
});
