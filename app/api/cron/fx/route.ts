import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { allCountryRules } from "@/lib/country-store";
import { currencyForCountry } from "@/lib/country-currency";
import { PRACTICE_CURRENCY } from "@/lib/money";
import { fetchRatesWithFallback } from "@/lib/fx-feed";
import { saveRate, allRates } from "@/lib/fx-store";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Keeps the stored rates current.
 *
 * Run once a day by Vercel Cron, and on demand from the dashboard. It fetches
 * once and writes a rate for each currency an enabled country is quoted in —
 * nothing else, because a rate nobody can be shown is a row that only makes the
 * settings page harder to read.
 *
 * A country with no rate is quoted in rupees, so a failed run is not an
 * incident: the previous rates stand, and when they eventually go stale the
 * site falls back to the currency it bills in anyway.
 */

/**
 * Rates set by hand are left alone.
 *
 * Someone typed them, probably because a feed had the wrong number or none at
 * all, and having a scheduled job quietly overwrite that would make the manual
 * setting useless. Removing the manual rate is how you go back to the feed, and
 * the dashboard says so.
 */
function manualCurrencies(stored: { currency: string; source: string }[]): Set<string> {
  return new Set(
    stored.filter((rate) => rate.source === "manual").map((rate) => rate.currency)
  );
}

/** The currencies an enabled country would actually be quoted in. */
export function wantedCurrencies(
  rules: { country: string; enabled: boolean }[]
): string[] {
  const wanted = new Set<string>();
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const currency = currencyForCountry(rule.country);
    if (currency !== PRACTICE_CURRENCY) wanted.add(currency);
  }
  return [...wanted].sort();
}

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function refreshRates(ref: string) {
  const rules = await allCountryRules();
  const wanted = wantedCurrencies(rules);

  if (wanted.length === 0) {
    // Nothing is enabled, so there is nothing worth asking a provider for.
    log.info("fx.nothing_wanted", { ref });
    return { fetched: 0, stored: 0, skipped: 0, provider: null as string | null };
  }

  const feed = await fetchRatesWithFallback();
  if (!feed) {
    log.error("fx.no_provider_answered", { ref, wanted: wanted.length });
    return { fetched: 0, stored: 0, skipped: 0, provider: null as string | null };
  }

  const manual = manualCurrencies(await allRates());
  let stored = 0;
  let skipped = 0;

  for (const currency of wanted) {
    if (manual.has(currency)) {
      skipped += 1;
      continue;
    }
    const perRupee = feed.rates.get(currency);
    if (perRupee === undefined) {
      // The provider does not carry it. The country stays in rupees, which is
      // correct and is why coverage decided which provider is the default.
      log.warn("fx.currency_missing", { ref, currency, provider: feed.provider });
      continue;
    }

    try {
      await saveRate(currency, perRupee, "feed");
      stored += 1;
    } catch (error) {
      // One bad rate must not cost the rest of the run.
      log.error("fx.store_failed", { ref, currency, ...errorFields(error) });
    }
  }

  log.info("fx.refreshed", {
    ref,
    provider: feed.provider,
    asOf: feed.asOf,
    wanted: wanted.length,
    stored,
    skipped,
  });

  return { fetched: feed.rates.size, stored, skipped, provider: feed.provider };
}

export async function GET(req: Request) {
  const ref = newRef();

  if (!authorised(req)) {
    log.warn("fx.rejected", { ref });
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  if (!dbConfigured()) {
    log.error("fx.no_database", { ref });
    return NextResponse.json({ error: "No database configured", ref }, { status: 503 });
  }

  try {
    const result = await refreshRates(ref);
    return NextResponse.json({ ok: true, ref, ...result });
  } catch (error) {
    log.error("fx.failed", { ref, ...errorFields(error) });
    return NextResponse.json({ error: "Could not refresh rates", ref }, { status: 500 });
  }
}
