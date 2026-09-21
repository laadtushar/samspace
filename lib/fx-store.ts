import { sql, dbConfigured } from "@/lib/db";
import { isCurrencyCode, PRACTICE_CURRENCY } from "@/lib/money";
import type { FxRate, RateSource } from "@/lib/convert";

/**
 * The rates the practice quotes with.
 *
 * Converted prices needed a rate and there was nowhere to keep one, so the
 * pricing endpoint passed null and always answered in rupees. A feed was the
 * obvious source and none is reachable from here — so the practice is the
 * source, and a feed becomes a way of filling this table rather than a
 * prerequisite for having anything in it.
 */

/** A rate as stored, with the age the dashboard shows. */
export interface StoredRate extends FxRate {
  source: RateSource;
  updatedAt: string;
}

interface Row {
  currency: string;
  per_rupee: string | number;
  as_of: Date | string;
  source: string;
  updated_at: Date | string;
}

/**
 * numeric comes back as a string from pg, deliberately — it is exact, and
 * JavaScript's number is not. It has to become a number to multiply with, and
 * the values here are small enough that the conversion is lossless; what would
 * not be safe is letting an unparseable one through as NaN, which would price
 * every tier at nothing.
 */
function toRate(row: Row): StoredRate | null {
  const perRupee = Number(row.per_rupee);
  if (!Number.isFinite(perRupee) || perRupee <= 0) return null;

  return {
    currency: row.currency,
    perRupee,
    asOf: new Date(row.as_of).toISOString(),
    source: row.source === "feed" ? "feed" : "manual",
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Every stored rate, for the dashboard. Empty without a database. */
export async function allRates(): Promise<StoredRate[]> {
  if (!dbConfigured()) return [];
  const rows = (await sql()`
    select currency, per_rupee, as_of, source, updated_at
    from fx_rates
    order by currency
  `) as unknown as Row[];
  return rows.map(toRate).filter((r): r is StoredRate => r !== null);
}

/**
 * The rate for one currency, or null.
 *
 * Null for the practice's own currency too: converting rupees into rupees is
 * not a conversion, and a row claiming to do it would be a rate that could
 * disagree with itself.
 */
export async function rateFor(currency: string): Promise<StoredRate | null> {
  if (!dbConfigured()) return null;
  if (!isCurrencyCode(currency) || currency === PRACTICE_CURRENCY) return null;

  const rows = (await sql()`
    select currency, per_rupee, as_of, source, updated_at
    from fx_rates
    where currency = ${currency}
    limit 1
  `) as unknown as Row[];

  return rows[0] ? toRate(rows[0]) : null;
}

/** Why a rate was refused, for the dashboard to show. Empty when it is fine. */
export function rateProblem(currency: string, perRupee: unknown): string {
  if (!isCurrencyCode(currency)) {
    return "Use a three-letter currency code, like USD or AED.";
  }
  if (currency === PRACTICE_CURRENCY) {
    return `Prices are already in ${PRACTICE_CURRENCY} — there is nothing to convert.`;
  }
  const value = typeof perRupee === "string" ? Number(perRupee) : perRupee;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "Enter how many units one rupee buys, as a positive number.";
  }
  return "";
}

/**
 * Stores a rate, replacing any rate for that currency.
 *
 * `as_of` moves to now on every save because a hand-set rate is true as of when
 * someone set it — that is what its age means, and what the staleness window
 * measures.
 */
export async function saveRate(
  currency: string,
  perRupee: number,
  source: RateSource = "manual"
): Promise<void> {
  const problem = rateProblem(currency, perRupee);
  if (problem) throw new Error(problem);
  if (!dbConfigured()) {
    throw new Error("No database configured — set DATABASE_URL to save rates.");
  }

  await sql()`
    insert into fx_rates (currency, per_rupee, as_of, source, updated_at)
    values (${currency}, ${perRupee}, now(), ${source}, now())
    on conflict (currency) do update
      set per_rupee = excluded.per_rupee,
          as_of = excluded.as_of,
          source = excluded.source,
          updated_at = now()
  `;
}

/** Removes a rate, so that currency goes back to being quoted in rupees. */
export async function deleteRate(currency: string): Promise<boolean> {
  if (!dbConfigured()) return false;
  if (!isCurrencyCode(currency)) return false;

  const rows = (await sql()`
    delete from fx_rates where currency = ${currency} returning currency
  `) as unknown as { currency: string }[];
  return rows.length > 0;
}
