/**
 * An amount, and which money it is.
 *
 * The site builds "₹500" by hand in four places — the rate formatter, the range
 * builder, the token values, the structured data — each one a template literal
 * with a rupee sign typed into it. That works exactly as long as there is one
 * currency, and the codebase has just finished removing the same shape of
 * duplication from prices themselves.
 *
 * So the symbol is derived rather than typed, from the currency code and
 * nothing else. Nothing about what a visitor sees changes: this reproduces the
 * site's existing rendering, and there is a test pinning that.
 */

/** What this practice charges in. Every stored amount defaults to it. */
export const PRACTICE_CURRENCY = "INR";

export interface Money {
  /** In major units — rupees, not paise. */
  amount: number;
  /** ISO 4217, three uppercase letters. */
  currency: string;
}

export function money(amount: number, currency = PRACTICE_CURRENCY): Money {
  return { amount, currency };
}

/** True for three uppercase letters, which is all ISO 4217 codes are. */
export function isCurrencyCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

/*
  Grouping separators are the one thing that cannot simply follow the locale.

  The site has always shown ₹1000, not ₹1,000 — on the page, in the rates list,
  in the dashboard field. Turning grouping on would change what every visitor
  reads, which is a visible change, not a refactor. So the practice's own
  currency keeps the site's convention, and every other currency gets its own:
  a converted price in yen or won runs to five and six figures, where separators
  are the difference between a number and a smear.
*/
function groupingFor(currency: string): boolean {
  return currency !== PRACTICE_CURRENCY;
}

/**
 * Decimals a whole amount does not need.
 *
 * ₹500.00 and $12.00 are how a ledger writes a price, not how a page does. A
 * fractional amount keeps the currency's own precision — two places for most,
 * none for yen, three for the dinars.
 */
function fractionDigitsFor(amount: number, currency: string): number {
  if (Number.isInteger(amount)) return 0;
  // Intl types this as optional; in practice every currency resolves one, and
  // two is the right guess for anything that somehow does not.
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

/**
 * One amount, as a reader sees it.
 *
 * Falls back to "<CODE> <amount>" for anything Intl will not format — an
 * unknown code, a NaN — rather than throwing. A price is not worth a 500, and a
 * visible oddity is easier to notice and fix than a blank space where a number
 * should be.
 */
export function formatMoney(
  value: Money | number,
  currency = PRACTICE_CURRENCY
): string {
  const { amount, currency: code } =
    typeof value === "number" ? money(value, currency) : value;

  if (!Number.isFinite(amount)) return "";

  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      useGrouping: groupingFor(code),
      maximumFractionDigits: fractionDigitsFor(amount, code),
      minimumFractionDigits: fractionDigitsFor(amount, code),
    }).format(amount);
  } catch {
    return `${code} ${amount}`;
  }
}

/** The en dash is the site's, and the reason this is not built inline. */
const RANGE_DASH = "–";

/**
 * A span of prices, as the site writes one: ₹500–₹1000.
 *
 * Both ends carry the symbol. "₹500–1000" reads as a discount off ₹500 at a
 * glance, and this is the number people decide on.
 */
export function formatMoneyRange(
  low: number,
  high: number,
  currency = PRACTICE_CURRENCY
): string {
  return `${formatMoney(low, currency)}${RANGE_DASH}${formatMoney(high, currency)}`;
}
