import { describe, it, expect, vi, afterEach } from "vitest";
import {
  exchangeRateApi,
  currencyApi,
  activeProvider,
  fetchRates,
  fetchRatesWithFallback,
  providerChain,
  PROVIDERS,
} from "@/lib/fx-feed";
import {
  erApiPayload,
  currencyApiPayload,
  frankfurterPayload,
} from "./fixtures/fx-payloads";

/**
 * Reading a rate feed.
 *
 * Every payload here was captured from the live provider, so these test the
 * shapes that actually arrive rather than the shapes the documentation
 * describes. The two are not reliably the same thing, and the cost of guessing
 * wrong is a wrong price on a public page.
 */

const previousProvider = process.env.FX_PROVIDER;

afterEach(() => {
  if (previousProvider === undefined) delete process.env.FX_PROVIDER;
  else process.env.FX_PROVIDER = previousProvider;
});

describe("open.er-api.com", () => {
  it("reads the real response", () => {
    const result = exchangeRateApi.parse(erApiPayload, "INR");
    expect(result).not.toBeNull();
    expect(result!.rates.get("AED")).toBe(0.038235);
    expect(result!.rates.get("USD")).toBe(0.010413);
  });

  it("quotes per rupee, not per unit of the foreign currency", () => {
    /*
      The single most consequential thing about this payload. A rupee buys
      0.038 dirhams; a dirham buys about 26 rupees. Reading it the wrong way
      round would price a ₹800 session at AED 20,920 and nothing downstream
      would notice, because both are numbers.
    */
    const result = exchangeRateApi.parse(erApiPayload, "INR")!;
    expect(result.rates.get("AED")).toBeLessThan(1);
    expect(800 * result.rates.get("AED")!).toBeCloseTo(30.6, 1);
  });

  it("covers the Gulf and South Asia, which is why it is the default", () => {
    const result = exchangeRateApi.parse(erApiPayload, "INR")!;
    for (const code of ["AED", "SAR", "QAR", "KWD", "BHD", "OMR", "NPR", "LKR", "BDT", "PKR"]) {
      expect(result.rates.has(code)).toBe(true);
    }
  });

  it("takes the provider's own timestamp", () => {
    const result = exchangeRateApi.parse(erApiPayload, "INR")!;
    expect(result.asOf).toBe(new Date(1789948951 * 1000).toISOString());
  });

  it("drops the base rather than storing a rate from rupees to rupees", () => {
    const result = exchangeRateApi.parse(erApiPayload, "INR")!;
    expect(result.rates.has("INR")).toBe(false);
  });

  it("refuses a payload that is not reporting success", () => {
    const failed = { ...erApiPayload, result: "error", "error-type": "unsupported-code" };
    expect(exchangeRateApi.parse(failed, "INR")).toBeNull();
  });

  it("refuses rates quoted against a different base than the one asked for", () => {
    // Asking for rupees and being answered in dollars would convert every
    // tier by a factor of about eighty-five.
    const usd = { ...erApiPayload, base_code: "USD" };
    expect(exchangeRateApi.parse(usd, "INR")).toBeNull();
  });

  it("refuses a payload where the base is not exactly one of itself", () => {
    /*
      The cheapest possible proof the numbers are per rupee. An inverted
      payload has INR at roughly 96, not 1.
      */
    const inverted = {
      ...erApiPayload,
      rates: { ...erApiPayload.rates, INR: 95.99, AED: 26.15 },
    };
    expect(exchangeRateApi.parse(inverted, "INR")).toBeNull();
  });

  it("refuses a payload with no usable rates at all", () => {
    const empty = { ...erApiPayload, rates: { INR: 1 } };
    expect(exchangeRateApi.parse(empty, "INR")).toBeNull();
  });

  it("refuses something that is not this provider's response", () => {
    expect(exchangeRateApi.parse(frankfurterPayload, "INR")).toBeNull();
    expect(exchangeRateApi.parse(null, "INR")).toBeNull();
    expect(exchangeRateApi.parse("rates", "INR")).toBeNull();
  });
});

describe("the currency-api fallback", () => {
  it("reads its real response, from under the base-named key", () => {
    const result = currencyApi.parse(currencyApiPayload, "INR");
    expect(result).not.toBeNull();
    expect(result!.rates.get("AED")).toBe(0.038273295);
  });

  it("upper-cases the codes, because it sends them lower", () => {
    const result = currencyApi.parse(currencyApiPayload, "INR")!;
    expect(result.rates.has("USD")).toBe(true);
    expect([...result.rates.keys()].every((c) => c === c.toUpperCase())).toBe(true);
  });

  it("drops crypto, metals and currencies that no longer exist", () => {
    const result = currencyApi.parse(currencyApiPayload, "INR")!;
    // None of these is anything a session is billed in.
    for (const junk of ["BTC", "ETH", "SHIB", "PEPE", "XAU", "XAG", "1INCH"]) {
      expect(result.rates.has(junk)).toBe(false);
    }
    // USDT is three letters plus one, and is not ISO 4217 either.
    expect(result.rates.has("USDT")).toBe(false);
  });

  it("agrees with the primary provider, which is the point of having it", () => {
    const primary = exchangeRateApi.parse(erApiPayload, "INR")!;
    const fallback = currencyApi.parse(currencyApiPayload, "INR")!;
    for (const code of ["AED", "USD", "GBP", "EUR", "SGD"]) {
      const a = primary.rates.get(code)!;
      const b = fallback.rates.get(code)!;
      // Within half a percent. A provider that has quietly gone wrong
      // disagrees with one that has not.
      expect(Math.abs(a - b) / a).toBeLessThan(0.005);
    }
  });

  it("refuses a payload whose base key is missing", () => {
    expect(currencyApi.parse({ date: "2026-09-20", usd: { usd: 1 } }, "INR")).toBeNull();
  });
});

describe("Frankfurter, and why it is not an option", () => {
  it("is missing every currency this practice most needs", () => {
    /*
      Not a test of our code — a test of the claim the code comments make, so
      that if someone revisits the decision they find the reason measured
      rather than asserted.
    */
    const rates = frankfurterPayload.rates as Record<string, number>;
    for (const absent of ["AED", "SAR", "QAR", "KWD", "BHD", "OMR", "NPR", "LKR", "BDT", "PKR"]) {
      expect(rates[absent]).toBeUndefined();
    }
    expect(Object.keys(rates).length).toBeLessThan(30);
  });

  it("is not selectable", () => {
    expect(Object.keys(PROVIDERS)).not.toContain("api.frankfurter.app");
  });
});

describe("choosing a provider", () => {
  it("defaults to the one with the coverage", () => {
    delete process.env.FX_PROVIDER;
    expect(activeProvider().name).toBe(exchangeRateApi.name);
  });

  it("can be pointed at another without changing code", () => {
    process.env.FX_PROVIDER = currencyApi.name;
    expect(activeProvider().name).toBe(currencyApi.name);
  });

  it("falls back to the default rather than failing on a name nobody has", () => {
    // A typo in an environment variable should not stop rates updating.
    process.env.FX_PROVIDER = "not-a-provider";
    expect(activeProvider().name).toBe(exchangeRateApi.name);
  });
});

describe("fetching", () => {
  const ok = (payload: unknown) =>
    vi.fn(async (_url: RequestInfo | URL) =>
      new Response(JSON.stringify(payload), { status: 200 }));

  it("asks the provider's own URL for the practice's currency", async () => {
    const fetchImpl = ok(erApiPayload);
    await fetchRates(exchangeRateApi, "INR", fetchImpl as unknown as typeof fetch);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://open.er-api.com/v6/latest/INR");
  });

  it("returns null on a failed request rather than throwing", async () => {
    const failing = vi.fn(async () => new Response("nope", { status: 503 }));
    const result = await fetchRates(
      exchangeRateApi, "INR", failing as unknown as typeof fetch
    );
    expect(result).toBeNull();
  });

  it("returns null when the body parses but is not this provider's shape", async () => {
    const wrong = ok(frankfurterPayload);
    const result = await fetchRates(
      exchangeRateApi, "INR", wrong as unknown as typeof fetch
    );
    expect(result).toBeNull();
  });
});

describe("falling back", () => {
  const respond = (status: number, payload: unknown) =>
    new Response(typeof payload === "string" ? payload : JSON.stringify(payload), { status });

  it("tries the active provider first", () => {
    delete process.env.FX_PROVIDER;
    expect(providerChain()[0].name).toBe(exchangeRateApi.name);
  });

  it("puts every other provider behind it, and lists each once", () => {
    process.env.FX_PROVIDER = currencyApi.name;
    const chain = providerChain();
    expect(chain[0].name).toBe(currencyApi.name);
    expect(new Set(chain.map((p) => p.name)).size).toBe(chain.length);
    expect(chain.map((p) => p.name)).toContain(exchangeRateApi.name);
  });

  it("uses the second provider when the first is down", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("er-api")
        ? respond(503, "unavailable")
        : respond(200, currencyApiPayload));

    const result = await fetchRatesWithFallback(
      "INR", fetchImpl as unknown as typeof fetch,
      [exchangeRateApi, currencyApi]
    );

    expect(result?.provider).toBe(currencyApi.name);
    expect(result?.rates.get("AED")).toBe(0.038273295);
  });

  it("falls through a provider that answers 200 with the wrong shape", async () => {
    // The nastier outage: the host is up and serving something useless.
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("er-api")
        ? respond(200, { unexpected: true })
        : respond(200, currencyApiPayload));

    const result = await fetchRatesWithFallback(
      "INR", fetchImpl as unknown as typeof fetch,
      [exchangeRateApi, currencyApi]
    );
    expect(result?.provider).toBe(currencyApi.name);
  });

  it("survives a provider that throws rather than answers", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("er-api")) throw new Error("network unreachable");
      return respond(200, currencyApiPayload);
    });

    const result = await fetchRatesWithFallback(
      "INR", fetchImpl as unknown as typeof fetch,
      [exchangeRateApi, currencyApi]
    );
    expect(result?.provider).toBe(currencyApi.name);
  });

  it("answers null when every provider fails, so stored rates stand", async () => {
    const fetchImpl = vi.fn(async () => respond(503, "down"));
    const result = await fetchRatesWithFallback(
      "INR", fetchImpl as unknown as typeof fetch,
      [exchangeRateApi, currencyApi]
    );
    expect(result).toBeNull();
  });
});
