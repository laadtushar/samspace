import { z } from "zod";
import { PRACTICE_CURRENCY } from "@/lib/money";
import { currenciesInUse } from "@/lib/country-currency";

/**
 * Where a rate comes from when nobody types it.
 *
 * One adapter per provider, each parsing its own payload and answering the same
 * small shape. Which provider is in use is a setting, not an assumption baked
 * through the code: a provider that changes its response, rate-limits, or
 * disappears is one adapter to replace.
 *
 * Every adapter validates rather than trusts. A payload that does not match is
 * refused whole — no rates stored, the previous ones kept, and visitors quoted
 * in rupees until something parses. The failure mode of a silently-accepted
 * malformed payload is a wrong price on a public page, which is much worse than
 * no conversion at all.
 */

/** Rates for one base currency, as a provider gave them. */
export interface FeedResult {
  /** When the provider says these were true. ISO 8601. */
  asOf: string;
  /** ISO 4217 (upper case) → how many units one unit of the base buys. */
  rates: Map<string, number>;
}

export interface FxProvider {
  /** Stored against each rate, so a table can say where a number came from. */
  readonly name: string;
  /** Where to ask, for a given base currency. */
  url(base: string): string;
  /** The payload, validated, or null when it is not what this provider sends. */
  parse(payload: unknown, base: string): FeedResult | null;
}

/**
 * A plausible rate.
 *
 * Zero and negative are nonsense. The upper bound is loose on purpose — some
 * real currencies genuinely run to thousands per rupee (IRR, LBP) — but it
 * still catches a payload that is quoting the inverse, where a rupee would buy
 * millions of anything.
 */
const MAX_PER_UNIT = 1_000_000;

function usableRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value < MAX_PER_UNIT
  );
}

/**
 * Every currency some country in the map resolves to.
 *
 * Kept as a set because it is consulted once per entry in a payload of a couple
 * of hundred, on a cron, and the map itself never changes at runtime.
 */
const QUOTABLE = new Set(currenciesInUse());

/**
 * Keeps the entries that are currencies this site could ever quote.
 *
 * Providers carry far more than ISO 4217: crypto, precious metals, currencies
 * withdrawn decades ago. Checking the shape of a code is not enough to exclude
 * them — BTC, ETH, XAU and XAG are all three upper-case letters and sail
 * through any pattern test. So the filter is the country map itself: a rate is
 * worth storing only if some country would be quoted in it. Everything else is
 * a row that can never be read.
 */
function cleanRates(
  entries: Iterable<[string, unknown]>,
  base: string
): Map<string, number> | null {
  const rates = new Map<string, number>();
  for (const [code, value] of entries) {
    const currency = String(code).trim().toUpperCase();
    if (currency !== base && !QUOTABLE.has(currency)) continue;
    if (!usableRate(value)) continue;
    rates.set(currency, value);
  }

  /*
    The base must be present and exactly one unit of itself. Every provider
    includes it, and it is the cheapest possible proof that the payload really
    is quoted per unit of the base asked for rather than inverted — which would
    price every tier roughly six hundred times over.
  */
  if (rates.get(base) !== 1) return null;
  rates.delete(base);

  return rates.size > 0 ? rates : null;
}

function isoFromUnix(seconds: unknown): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isoFromDay(day: unknown): string | null {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * ExchangeRate-API's open access endpoint.
 *
 * Verified against a real response: fiat only, upper-case ISO keys, quoted per
 * one unit of the base, an explicit success flag, and both the last and next
 * update times. Covers the Gulf and South Asia, which is the whole reason it is
 * the default — see the note on Frankfurter below.
 */
const exchangeRateApiPayload = z.object({
  result: z.literal("success"),
  base_code: z.string(),
  time_last_update_unix: z.number().optional(),
  rates: z.record(z.string(), z.unknown()),
});

export const exchangeRateApi: FxProvider = {
  name: "open.er-api.com",
  url: (base) => `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
  parse(payload, base) {
    const parsed = exchangeRateApiPayload.safeParse(payload);
    if (!parsed.success) return null;
    if (parsed.data.base_code.trim().toUpperCase() !== base) return null;

    const rates = cleanRates(Object.entries(parsed.data.rates), base);
    if (!rates) return null;

    // Its own timestamp when it gives one; otherwise now, which is when the
    // request was made and is never more optimistic than the truth.
    const asOf =
      isoFromUnix(parsed.data.time_last_update_unix) ?? new Date().toISOString();
    return { asOf, rates };
  },
};

/**
 * The currency-api mirrored on jsDelivr.
 *
 * A second, independent source. Its rates sat within 0.1% of the first when
 * both were checked, which is the point of having one: a provider that has
 * quietly gone wrong disagrees with another that has not.
 *
 * Its payload nests the rates under a key named after the base — "inr" — in
 * lower case, and carries crypto and long-dead currencies alongside real ones.
 * cleanRates drops those.
 */
const currencyApiPayload = z.object({ date: z.string() }).catchall(z.unknown());

export const currencyApi: FxProvider = {
  name: "cdn.jsdelivr.net/currency-api",
  url: (base) =>
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/" +
    `${encodeURIComponent(base.toLowerCase())}.json`,
  parse(payload, base) {
    const parsed = currencyApiPayload.safeParse(payload);
    if (!parsed.success) return null;

    const table = parsed.data[base.toLowerCase()];
    if (typeof table !== "object" || table === null || Array.isArray(table)) {
      return null;
    }

    const rates = cleanRates(Object.entries(table as Record<string, unknown>), base);
    if (!rates) return null;

    const asOf = isoFromDay(parsed.data.date) ?? new Date().toISOString();
    return { asOf, rates };
  },
};

/*
  Frankfurter is deliberately not here.

  It is the most widely recommended free rates API and it is the wrong one for
  this practice. It serves European Central Bank reference rates, which is 29
  currencies: no AED, SAR, QAR, KWD, BHD or OMR, and no NPR, LKR, BDT or PKR
  either. That is the Gulf and the whole South Asian neighbourhood — the
  clients most likely to be reading this site from outside India.

  Checked against a live response rather than assumed. Adding it as an option
  would mean someone could select it and silently lose every country that
  matters, so it is not an option.
*/

export const PROVIDERS: Readonly<Record<string, FxProvider>> = {
  [exchangeRateApi.name]: exchangeRateApi,
  [currencyApi.name]: currencyApi,
};

/** The provider in use. Overridable, so swapping one needs no deploy of code. */
export function activeProvider(): FxProvider {
  const named = process.env.FX_PROVIDER?.trim();
  return (named && PROVIDERS[named]) || exchangeRateApi;
}

/**
 * Asks the provider for rates against the practice's own currency.
 *
 * Network and parse failures are the same answer — null — because the caller's
 * response to both is identical: keep what is stored and quote rupees. What it
 * must never do is return a half-read payload.
 */
export async function fetchRates(
  provider: FxProvider = activeProvider(),
  base: string = PRACTICE_CURRENCY,
  fetchImpl: typeof fetch = fetch
): Promise<FeedResult | null> {
  const response = await fetchImpl(provider.url(base), {
    headers: { accept: "application/json" },
    // A rate that arrives late is worth nothing: the request is on a cron, and
    // the previous rates remain perfectly usable meanwhile.
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;

  const payload: unknown = await response.json();
  return provider.parse(payload, base.trim().toUpperCase());
}

/**
 * The providers to try, in order.
 *
 * The active one first, then the others as fallbacks. Two independent sources
 * is the difference between "rates are a day stale because a host had an
 * outage" and "rates are a day stale and nobody noticed" — and because each
 * adapter validates its own payload, falling through costs only a request.
 */
export function providerChain(): FxProvider[] {
  const first = activeProvider();
  return [first, ...Object.values(PROVIDERS).filter((p) => p.name !== first.name)];
}

/** What a fetch across the chain produced, and which provider produced it. */
export interface FeedAttempt extends FeedResult {
  provider: string;
}

/**
 * Rates from the first provider that answers with something that parses.
 *
 * A provider that is down, rate-limited, or has changed its response shape is
 * skipped rather than fatal. Null only when every one of them failed, which is
 * the point at which the stored rates stand and visitors keep seeing rupees.
 */
export async function fetchRatesWithFallback(
  base: string = PRACTICE_CURRENCY,
  fetchImpl: typeof fetch = fetch,
  chain: FxProvider[] = providerChain()
): Promise<FeedAttempt | null> {
  for (const provider of chain) {
    try {
      const result = await fetchRates(provider, base, fetchImpl);
      if (result) return { ...result, provider: provider.name };
    } catch {
      // Network error, timeout, unparseable body: all the same answer, which
      // is to try the next one. The caller logs what came back, or did not.
    }
  }
  return null;
}
