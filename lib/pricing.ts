import { PRACTICE_CURRENCY, formatMoney, formatMoneyRange } from "@/lib/money";
import { rateAmount, isStudentRate, priceRangeOf } from "@/lib/rates";
import { currencyForCountry } from "@/lib/country-currency";
import { convertScale, rateIsFresh, type FxRate } from "@/lib/convert";
import { basisFor, type CountryRule } from "@/lib/country-pricing";

/**
 * What a particular visitor should be shown, and why.
 *
 * Two decisions, kept apart because they have different reasons:
 *
 *   Which tiers they may choose from — a policy about who the concessional
 *   rate is for, which does not change because a rate feed is down.
 *
 *   Which money the figures are in — a presentation choice that depends on
 *   whether there is a rate worth quoting.
 *
 * Tangling them is how a visitor in London ends up offered a student rate
 * because the feed happened to fail, or refused one in Delhi because it
 * happened to work.
 */

/** Where the practice is, and the only place its concession applies. */
export const HOME_COUNTRY = "IN";

/**
 * Said wherever a converted figure appears.
 *
 * Not optional decoration. Every session is charged and settled in rupees, so a
 * figure in another currency is an estimate of an invoice that will arrive in
 * this one. A converted price that does not say so is a number someone will
 * reasonably expect to be charged.
 */
export const CONVERTED_NOTE = "Approximate — sessions are billed in INR";

export interface PricedTier {
  /** The canonical amount, always rupees. Nothing downstream re-derives this. */
  rupees: number;
  /** What the visitor reads. */
  display: string;
  /** The concessional tier. */
  student: boolean;
}

export interface PricingView {
  /** ISO 4217 of what is being shown. */
  currency: string;
  /** True when these are the rupees the practice actually charges. */
  native: boolean;
  tiers: PricedTier[];
  /** The span across what is shown, as the site writes one. */
  range: string;
  /**
   * Every rate on the scale converted, including ones this visitor may not
   * choose.
   *
   * `tiers` is what they may pick; this is what the page already says. Copy
   * elsewhere — the FAQ, the intake form — mentions the concessional rate to
   * everyone, so a foreign visitor reads a figure that is not on offer to them
   * and still has to be shown in money they understand. Leaving it in rupees
   * beside a converted scale is the inconsistency this exists to prevent.
   *
   * Empty when nothing is converted.
   */
  all: PricedTier[];
  /** Present only when the figures are converted. */
  note?: string;
}

/**
 * Whether the concessional rate is on offer here.
 *
 * It is funded by Indian clients choosing to pay more, so it is offered where
 * that holds. Elsewhere the scale is the full band and nothing hints at a rate
 * the visitor cannot take.
 */
export function studentRateApplies(country: unknown): boolean {
  return typeof country === "string" && country.trim().toUpperCase() === HOME_COUNTRY;
}

/** The tiers this visitor may actually choose, in the order they are stored. */
export function tiersFor(scale: readonly string[], country: unknown): string[] {
  const eligible = studentRateApplies(country)
    ? [...scale]
    : scale.filter((entry) => !isStudentRate(entry));
  // Never leave someone with nothing to pick: a scale that is entirely
  // concessional is a configuration mistake, not a reason to show no prices.
  return eligible.length > 0 ? eligible : [...scale];
}

/** Rupees, exactly as the site has always shown them. */
function nativeView(entries: readonly string[]): PricingView {
  const tiers = entries.flatMap<PricedTier>((entry) => {
    const rupees = rateAmount(entry);
    if (rupees === null || rupees <= 0) return [];
    return [{ rupees, display: formatMoney(rupees), student: isStudentRate(entry) }];
  });

  return {
    currency: PRACTICE_CURRENCY,
    native: true,
    tiers,
    range: priceRangeOf(entries),
    // Nothing is converted, so there is nothing for text substitution to do.
    all: [],
  };
}

/**
 * The scale as this visitor should see it.
 *
 * Falls back to rupees whenever there is any reason to: no rate, a stale one,
 * one for the wrong currency, or a conversion that would flatten two tiers into
 * the same figure. Rupees are never wrong — they are what is charged — so the
 * fallback costs nothing, which is what makes it the right answer every time
 * the alternative is uncertain.
 */
export interface PricingOptions {
  /**
   * What the practice has decided about this country. Absent means nothing has
   * been decided, which is the same as not enabled: rupees.
   */
  rule?: CountryRule | null;
  /** Applied to any enabled country that has not set a markup of its own. */
  defaultMarkupPercent?: number;
  note?: string;
  now?: Date;
}

export function pricingFor(
  scale: readonly string[],
  country: unknown,
  rate: FxRate | null,
  options: PricingOptions = {}
): PricingView {
  const {
    rule = null,
    defaultMarkupPercent = 0,
    note = CONVERTED_NOTE,
    now = new Date(),
  } = options;

  /*
    The basis is rupees either way, so it is chosen before anything else and
    the rest of this function neither knows nor cares whether the figures came
    from the base scale, a markup, or amounts typed for this country. A
    country that is not enabled gets the base scale untouched.
  */
  const entries = tiersFor(basisFor(scale, rule, defaultMarkupPercent), country);
  const native = nativeView(entries);

  /*
    Not enabled is the end of it. A rate existing for a currency is not a
    decision to quote in it — that decision is this flag, and keeping them
    apart is what stops adding a euro rate from silently changing what every
    visitor in Germany is shown.
  */
  if (!rule?.enabled) return native;

  const currency = currencyForCountry(country);
  if (currency === PRACTICE_CURRENCY) return native;
  if (!rate || rate.currency !== currency || !rateIsFresh(rate, now)) return native;
  if (native.tiers.length === 0) return native;

  const converted = convertScale(
    native.tiers.map((tier) => tier.rupees),
    rate
  );
  if (!converted) return native;

  const tiers = native.tiers.map((tier, i) => ({
    ...tier,
    display: formatMoney(converted[i], currency),
  }));

  /*
    The whole scale, converted the same way, so copy that mentions a rate this
    visitor cannot choose still reads in their own money. Converted as one
    scale rather than tier by tier: rounding is decided across a set, and
    converting the concessional rate separately could round it to the same
    figure as the lowest full rate.
  */
  const everyRate = basisFor(scale, rule, defaultMarkupPercent);
  const all = pricedAll(everyRate, rate, currency);

  return {
    currency,
    native: false,
    tiers,
    range: formatMoneyRange(
      Math.min(...converted),
      Math.max(...converted),
      currency
    ),
    all,
    note,
  };
}

/**
 * Every entry on a scale, converted, or nothing.
 *
 * Nothing rather than a partial list: a half-converted scale is worse than an
 * unconverted one, because the reader cannot tell which figures moved.
 */
function pricedAll(
  entries: readonly string[],
  rate: FxRate,
  currency: string
): PricedTier[] {
  const native = nativeView(entries).tiers;
  if (native.length === 0) return [];

  const converted = convertScale(
    native.map((tier) => tier.rupees),
    rate
  );
  if (!converted) return [];

  return native.map((tier, i) => ({
    ...tier,
    display: formatMoney(converted[i], currency),
  }));
}
