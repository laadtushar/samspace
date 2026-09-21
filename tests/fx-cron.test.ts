import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { erApiPayload } from "./fixtures/fx-payloads";

/**
 * The scheduled rate refresh.
 *
 * What matters is what it writes and what it leaves alone: only currencies an
 * enabled country would be quoted in, never a rate somebody set by hand, and
 * nothing at all when no provider answers.
 */

const rules = vi.fn();
const stored = vi.fn();
const saved = vi.fn();

vi.mock("@/lib/country-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/country-store")>()),
  allCountryRules: () => rules(),
}));

vi.mock("@/lib/fx-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/fx-store")>()),
  allRates: () => stored(),
  saveRate: (currency: string, perRupee: number, source: string) =>
    saved(currency, perRupee, source),
}));

vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  dbConfigured: () => true,
}));

const { GET, refreshRates, wantedCurrencies } = await import("@/app/api/cron/fx/route");

const previousSecret = process.env.CRON_SECRET;
const enabled = (country: string) => ({
  country,
  enabled: true,
  markupPercent: 0,
  overrideScale: null,
});

const feedResponds = (payload: unknown, status = 200) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(payload), { status })
  );

beforeEach(() => {
  process.env.CRON_SECRET = "a-secret";
  rules.mockReset().mockResolvedValue([]);
  stored.mockReset().mockResolvedValue([]);
  saved.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (previousSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousSecret;
});

const ask = (secret?: string) =>
  GET(
    new Request("https://www.samvritispace.com/api/cron/fx", {
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    })
  );

describe("who may run it", () => {
  it("refuses a request with no secret", async () => {
    expect((await ask()).status).toBe(401);
  });

  it("refuses the wrong secret", async () => {
    expect((await ask("not-the-secret")).status).toBe(401);
  });

  it("refuses everything when no secret is configured at all", async () => {
    // An endpoint that reaches out to a third party on demand should not be
    // open because a variable was forgotten.
    delete process.env.CRON_SECRET;
    expect((await ask("a-secret")).status).toBe(401);
  });

  it("runs for Vercel's own signed request", async () => {
    feedResponds(erApiPayload);
    expect((await ask("a-secret")).status).toBe(200);
  });
});

describe("which currencies it asks for", () => {
  it("is the ones enabled countries are quoted in", () => {
    expect(
      wantedCurrencies([enabled("AE"), enabled("US"), enabled("GB")])
    ).toEqual(["AED", "GBP", "USD"]);
  });

  it("ignores countries that are not enabled", () => {
    expect(
      wantedCurrencies([{ ...enabled("AE"), enabled: false }, enabled("US")])
    ).toEqual(["USD"]);
  });

  it("never asks for the currency the practice already bills in", () => {
    // A rupee-to-rupee rate is not a rate.
    expect(wantedCurrencies([enabled("IN")])).toEqual([]);
  });

  it("asks once for a currency several countries share", () => {
    expect(wantedCurrencies([enabled("DE"), enabled("FR"), enabled("IT")])).toEqual([
      "EUR",
    ]);
  });
});

describe("refreshing", () => {
  it("does not call a provider at all when nothing is enabled", async () => {
    const fetchSpy = feedResponds(erApiPayload);
    const result = await refreshRates("ref");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.stored).toBe(0);
    expect(result.provider).toBeNull();
  });

  it("stores a feed rate for each enabled country's currency", async () => {
    rules.mockResolvedValue([enabled("AE"), enabled("US")]);
    feedResponds(erApiPayload);

    const result = await refreshRates("ref");

    expect(result.stored).toBe(2);
    expect(saved).toHaveBeenCalledWith("AED", 0.038235, "feed");
    expect(saved).toHaveBeenCalledWith("USD", 0.010413, "feed");
  });

  it("stores nothing for a country nobody enabled", async () => {
    rules.mockResolvedValue([enabled("AE")]);
    feedResponds(erApiPayload);

    await refreshRates("ref");

    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls.map((c) => c[0])).toEqual(["AED"]);
  });

  it("leaves a rate somebody set by hand alone", async () => {
    /*
      Someone typed it, probably because the feed had the wrong number. A
      scheduled job overwriting that every night would make the manual setting
      useless — removing it is how you go back to the feed.
    */
    rules.mockResolvedValue([enabled("AE"), enabled("US")]);
    stored.mockResolvedValue([
      { currency: "AED", source: "manual" },
      { currency: "USD", source: "feed" },
    ]);
    feedResponds(erApiPayload);

    const result = await refreshRates("ref");

    expect(result.skipped).toBe(1);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith("USD", 0.010413, "feed");
  });

  it("stores the rest when the provider does not carry one currency", async () => {
    // The uncarried country simply stays in rupees, which is never wrong.
    rules.mockResolvedValue([enabled("AE"), enabled("CU")]);
    feedResponds(erApiPayload);

    const result = await refreshRates("ref");

    expect(result.stored).toBe(1);
    expect(saved).toHaveBeenCalledWith("AED", 0.038235, "feed");
  });

  it("stores nothing when no provider answers, so the old rates stand", async () => {
    rules.mockResolvedValue([enabled("AE")]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 503 }));

    const result = await refreshRates("ref");

    expect(result.provider).toBeNull();
    expect(saved).not.toHaveBeenCalled();
  });

  it("keeps going when one rate fails to store", async () => {
    rules.mockResolvedValue([enabled("AE"), enabled("US")]);
    feedResponds(erApiPayload);
    saved.mockImplementation(async (currency: string) => {
      if (currency === "AED") throw new Error("write failed");
    });

    const result = await refreshRates("ref");

    expect(result.stored).toBe(1);
    expect(saved).toHaveBeenCalledTimes(2);
  });

  it("says which provider answered", async () => {
    rules.mockResolvedValue([enabled("US")]);
    feedResponds(erApiPayload);
    expect((await refreshRates("ref")).provider).toBe("open.er-api.com");
  });
});
