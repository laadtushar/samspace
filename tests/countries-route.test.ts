import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

/**
 * The endpoint the settings page uses.
 *
 * Run against a real Postgres, because the parts worth testing here are the
 * round trip and the preview — and a preview built on a mocked store proves
 * only that the mock agrees with itself.
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("country settings over HTTP", () => {
  let routes: typeof import("@/app/api/admin/countries/route");
  let sql: typeof import("@/lib/db").sql;
  const previousUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    vi.doMock("@/lib/admin-guard", () => ({ requireAdmin: async () => null }));
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
    routes = await import("@/app/api/admin/countries/route");
  });

  afterAll(() => {
    vi.doUnmock("@/lib/admin-guard");
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  beforeEach(async () => {
    await sql()`delete from country_pricing`;
    await sql()`delete from fx_rates`;
  });

  const post = (body: unknown) =>
    routes.POST(
      new Request("https://www.samvritispace.com/api/admin/countries", {
        method: "POST",
        body: JSON.stringify(body),
      })
    );

  const list = async () => {
    const res = await routes.GET();
    return (await res.json()) as {
      countries: import("@/lib/country-preview").CountryPreview[];
      localCurrencyEnabled: boolean;
    };
  };

  it("starts with nothing decided, which is everyone in rupees", async () => {
    expect((await list()).countries).toEqual([]);
  });

  it("stores a country and previews what it would show", async () => {
    await post({ country: "ae", enabled: true, markupPercent: 50 });

    const { countries } = await list();
    expect(countries).toHaveLength(1);
    expect(countries[0].country).toBe("AE");
    expect(countries[0].currency).toBe("AED");
    expect(countries[0].basis).toContain("₹1200");
  });

  it("says why a country with no rate still shows rupees", async () => {
    await post({ country: "AE", enabled: true });

    const { countries } = await list();
    expect(countries[0].view.native).toBe(true);
    expect(countries[0].reason).toContain("No AED rate yet");
  });

  it("converts once a rate exists, using the marked-up rupees", async () => {
    await sql()`
      insert into fx_rates (currency, per_rupee, as_of, source, updated_at)
      values ('AED', 0.0415, now(), 'feed', now())
    `;
    await post({ country: "AE", enabled: true, markupPercent: 50 });

    const { countries } = await list();
    expect(countries[0].view.native).toBe(false);
    expect(countries[0].view.currency).toBe("AED");
    expect(countries[0].reason).toBe("");
    // The rupees travelling alongside are the marked-up ones, so an invoice is
    // never raised for less than was quoted.
    expect(countries[0].view.tiers.map((t) => t.rupees)).toEqual([1200, 1350, 1500]);
  });

  it("leaves a rate for another country alone when one is enabled", async () => {
    await sql()`
      insert into fx_rates (currency, per_rupee, as_of, source, updated_at)
      values ('AED', 0.0415, now(), 'feed', now()), ('USD', 0.0113, now(), 'feed', now())
    `;
    await post({ country: "AE", enabled: true });

    const { countries } = await list();
    // The US was never enabled, so it is not here and sees rupees, rate or no
    // rate. That is the whole point of the switch.
    expect(countries.map((c) => c.country)).toEqual(["AE"]);
  });

  it("refuses a markup that is not a markup", async () => {
    const res = await post({ country: "AE", enabled: true, markupPercent: -50 });
    expect(res.status).toBe(400);
    expect((await list()).countries).toEqual([]);
  });

  it("refuses something that is not a country", async () => {
    expect((await post({ country: "ARE", enabled: true })).status).toBe(400);
    expect((await post({ country: "", enabled: true })).status).toBe(400);
  });

  it("refuses an override with no price in it", async () => {
    const res = await post({
      country: "AE",
      enabled: true,
      overrideScale: ["whatever you like"],
    });
    expect(res.status).toBe(400);
  });

  it("takes an override and prices from it rather than the markup", async () => {
    await post({
      country: "AE",
      enabled: true,
      markupPercent: 50,
      overrideScale: ["₹1111", "₹2222"],
    });
    expect((await list()).countries[0].basis).toEqual(["₹1111", "₹2222"]);
  });

  it("removes a country, putting it back to rupees", async () => {
    await post({ country: "AE", enabled: true });
    const res = await routes.DELETE(
      new Request("https://www.samvritispace.com/api/admin/countries?country=ae", {
        method: "DELETE",
      })
    );
    expect(res.status).toBe(200);
    expect((await list()).countries).toEqual([]);
  });

  it("does not treat removing a country twice as a failure", async () => {
    // The caller wanted it gone, and it is gone.
    await post({ country: "AE", enabled: true });
    const gone = () =>
      routes.DELETE(
        new Request("https://www.samvritispace.com/api/admin/countries?country=AE", {
          method: "DELETE",
        })
      );
    expect((await gone()).status).toBe(200);
    expect((await gone()).status).toBe(200);
  });

  it("reports the master switch, which can make every row moot", async () => {
    const body = await list();
    expect(typeof body.localCurrencyEnabled).toBe("boolean");
  });
});
