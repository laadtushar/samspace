import { pricingFor, type PricingView } from "@/lib/pricing";
import { currencyForCountry } from "@/lib/country-currency";
import { PRACTICE_CURRENCY } from "@/lib/money";
import { rateIsFresh, rateAgeDays, maxAgeFor, type FxRate } from "@/lib/convert";
import { basisFor, type CountryRule } from "@/lib/country-pricing";

/**
 * What one country is being shown, and why.
 *
 * The figures come from `pricingFor` — the same call the public endpoint makes,
 * with the same arguments — so a preview cannot claim something the site does
 * not do. Everything else here is explanation: when a country falls back to
 * rupees there is always a reason, and a settings page that shows the fallback
 * without the reason invites someone to re-enter a rate that was never the
 * problem.
 */

export interface CountryPreview {
  country: string;
  /** What this country would be quoted in, if it were quoted in anything. */
  currency: string;
  enabled: boolean;
  markupPercent: number;
  overrideScale: string[] | null;
  /** The rupee figures the conversion starts from, after markup or override. */
  basis: string[];
  /** Exactly what a visitor there is served. */
  view: PricingView;
  /** Why it is rupees. Empty when the figures are converted. */
  reason: string;
}

export function previewFor(
  scale: readonly string[],
  rule: CountryRule,
  rate: FxRate | null,
  now = new Date()
): CountryPreview {
  const currency = currencyForCountry(rule.country);
  const basis = basisFor(scale, rule);
  const view = pricingFor(scale, rule.country, rate, { rule, now });

  return {
    country: rule.country,
    currency,
    enabled: rule.enabled,
    markupPercent: rule.markupPercent,
    overrideScale: rule.overrideScale,
    basis,
    view,
    reason: view.native ? reasonForRupees(rule, currency, rate, now) : "",
  };
}

/**
 * Why a country is being quoted in rupees.
 *
 * In the order `pricingFor` decides, so the first true thing is the one that
 * actually stopped it — telling someone their rate is stale when the country
 * was never enabled would send them to fix the wrong thing.
 */
function reasonForRupees(
  rule: CountryRule,
  currency: string,
  rate: FxRate | null,
  now: Date
): string {
  if (!rule.enabled) {
    return "Not enabled — visitors here see rupees.";
  }
  if (currency === PRACTICE_CURRENCY) {
    return "Already billed in rupees, so there is nothing to convert.";
  }
  if (!rate) {
    return `No ${currency} rate yet. Rates arrive on the daily refresh, or set one by hand.`;
  }
  if (rate.currency !== currency) {
    return `The stored rate is for ${rate.currency}, not ${currency}.`;
  }
  if (!rateIsFresh(rate, now)) {
    const age = rateAgeDays(rate, now);
    // A rate whose date will not parse is stale by definition, and saying so
    // points at the stored value rather than sending someone to check a clock.
    if (age === null) {
      return `The ${currency} rate has no readable date, so rupees are shown instead.`;
    }
    return `The ${currency} rate is ${Math.floor(age)} days old — past the ${maxAgeFor(rate)}-day limit, so rupees are shown instead.`;
  }
  /*
    Everything above was fine, so the conversion itself was refused — which
    leaves one cause: rounding flattened two tiers into the same figure, and
    three identical prices say less than rupees do.
  */
  return `Converting to ${currency} would make the tiers read alike, so rupees are shown instead.`;
}
