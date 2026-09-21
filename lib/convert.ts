import { PRACTICE_CURRENCY, isCurrencyCode } from "@/lib/money";

/**
 * Turning a rupee price into a figure a visitor elsewhere can read.
 *
 * Every price this practice charges is in rupees and is settled in rupees. What
 * this produces is guidance — "roughly this much, in money you think in" — and
 * the code treats it that way: a conversion it cannot stand behind returns null
 * and the caller shows the rupee figure instead. A price nobody can act on is
 * worse than a price in a foreign currency.
 */

/**
 * Where a rate came from.
 *
 * Not bookkeeping — it decides how long the rate may be quoted for, and the two
 * cases are genuinely different. A fetched rate a fortnight old means the
 * fetcher is broken. A rate someone typed a fortnight ago means nothing is
 * broken at all: it is a decision, and it does not stop being one.
 */
export type RateSource = "manual" | "feed";

export interface FxRate {
  /** ISO 4217 of the currency being converted into. */
  currency: string;
  /** How many units of it one rupee buys. */
  perRupee: number;
  /** When the rate was true — fetched, or set by hand. ISO 8601. */
  asOf: string;
  /** Defaults to a feed, which is the stricter of the two. */
  source?: RateSource;
}

/**
 * How stale a fetched rate may be before it stops being quoted.
 *
 * Rates move slowly enough that a day or two is immaterial to a figure already
 * labelled as approximate. A fortnight is not: by then the number on the page
 * is a claim about a world that has moved, and the honest thing is to fall back
 * to the currency the price is actually in.
 */
export const MAX_RATE_AGE_DAYS = 14;

/**
 * The same, for a rate set by hand.
 *
 * Far longer, because the fortnight above is a check on a mechanism, not on the
 * number. Nothing has failed when a typed rate gets old, so expiring it on the
 * same timer would take a working price off the site and give nobody a reason.
 *
 * It does still expire. A year-old hand-set rate is quoting a figure about a
 * world that has moved just as surely, and the fallback — the rupee price the
 * practice actually bills — is always safe to show. The dashboard displays the
 * age so this is a prompt to revisit rather than a surprise.
 */
export const MAX_MANUAL_RATE_AGE_DAYS = 365;

/** How old this particular rate is allowed to be. */
export function maxAgeFor(rate: FxRate): number {
  return rate.source === "manual" ? MAX_MANUAL_RATE_AGE_DAYS : MAX_RATE_AGE_DAYS;
}

/** How many days old a rate is, or null when its timestamp is unreadable. */
export function rateAgeDays(rate: FxRate, now = new Date()): number | null {
  const asOf = new Date(rate.asOf);
  if (Number.isNaN(asOf.getTime())) return null;
  return (now.getTime() - asOf.getTime()) / 86_400_000;
}

export function rateIsFresh(rate: FxRate, now = new Date()): boolean {
  const days = rateAgeDays(rate, now);
  if (days === null) return false;
  // A rate from the future is a clock problem somewhere, not a fresh rate.
  return days >= 0 && days <= maxAgeFor(rate);
}

/**
 * The smallest unit a currency actually has.
 *
 * Intl knows this: none for yen and won, two for most, three for the Gulf
 * dinars. Rounding a price to two decimals in a currency that has none prints a
 * figure that cannot exist.
 */
export function minorUnitsFor(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * Candidate rounding steps for a figure of this size, coarsest first.
 *
 * 1, 2 and 5 at every scale — the sequence prices are actually written in.
 * Bounded below by what the currency can express (a tenth of a yen is not a
 * price) and above by a quarter of the figure, so a step can never swallow the
 * number it is rounding.
 */
export function roundingLadder(magnitude: number, currency: string): number[] {
  const finest = Math.pow(10, -minorUnitsFor(currency));
  const coarsest = Math.max(finest, magnitude / 4);

  const steps: number[] = [];
  for (let power = 4; power >= -3; power--) {
    for (const base of [5, 2, 1]) {
      const step = base * Math.pow(10, power);
      if (step >= finest && step <= coarsest) steps.push(step);
    }
  }
  return steps.length > 0 ? steps : [finest];
}

/** The coarsest step that still tidies a single figure rather than erasing it. */
export function roundingStepFor(amount: number, currency: string): number {
  return roundingLadder(amount, currency)[0];
}

function roundUp(value: number, step: number, minor: number): number {
  // Floating point: 0.1 + 0.2 arithmetic leaves 12.000000000000002 behind, and
  // that formats as a price with a tail of noise.
  return Number((Math.ceil(value / step) * step).toFixed(minor));
}

function usable(rupees: number, rate: FxRate): boolean {
  return (
    Number.isFinite(rupees) &&
    rupees > 0 &&
    isCurrencyCode(rate.currency) &&
    rate.currency !== PRACTICE_CURRENCY &&
    Number.isFinite(rate.perRupee) &&
    rate.perRupee > 0
  );
}

/**
 * A whole sliding scale converted at once, and the reason this is not a map
 * over `convert`.
 *
 * Rounding each rate on its own is how two of them end up the same number. At a
 * realistic rate ₹900 and ₹1000 both round to KWD 3.500, and a scale whose
 * tiers read alike is a choice with nothing to choose between — worse than no
 * conversion at all, because it looks deliberate.
 *
 * So the step is chosen for the set: the coarsest one on the ladder that still
 * tells every tier apart. Falling off the end of the ladder means even the
 * currency's smallest unit cannot separate them, and then there is no honest
 * figure to show and the caller falls back to rupees.
 *
 * Rounding is up, for the same reason everywhere else: the invoice is in rupees
 * and this is an estimate of it. Quoting less sets up an invoice that reads as
 * more than was advertised.
 */
export function convertScale(
  rupees: readonly number[],
  rate: FxRate
): number[] | null {
  if (rupees.length === 0) return null;
  if (!rupees.every((amount) => usable(amount, rate))) return null;

  const raw = rupees.map((amount) => amount * rate.perRupee);
  if (!raw.every((value) => Number.isFinite(value) && value > 0)) return null;

  const minor = minorUnitsFor(rate.currency);
  const distinctInputs = new Set(rupees).size;

  for (const step of roundingLadder(Math.max(...raw), rate.currency)) {
    const rounded = raw.map((value) => roundUp(value, step, minor));
    if (new Set(rounded).size === distinctInputs && rounded.every((v) => v > 0)) {
      return rounded;
    }
  }

  return null;
}

/**
 * One figure, converted.
 *
 * Prefer convertScale wherever a scale is being shown: this cannot know what
 * the figure sits next to, and two neighbours rounding alike is the failure
 * worth avoiding.
 */
export function convert(rupees: number, rate: FxRate): number | null {
  const converted = convertScale([rupees], rate);
  return converted ? converted[0] : null;
}
