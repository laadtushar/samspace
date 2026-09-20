import {
  rateAmount,
  isStudentRate,
  priceRangeOf,
  fullRates,
} from "@/lib/rates";

/**
 * Prices written once, referenced everywhere.
 *
 * The rate used to be typed out wherever it appeared: the services card, the
 * FAQ answer, the share descriptions, the body of every post. Changing it meant
 * finding all of them, and missing one meant the site quoted two prices at
 * once — which is what the reprice tool exists to clean up after.
 *
 * Instead, copy can say {{rate.range}} and the figure is filled in when the
 * page is rendered, from the rates list and nothing else. One place to edit,
 * and nowhere left to drift.
 *
 * Tokens resolve on the way out to the public site only. The dashboard reads
 * content unresolved, or editing a FAQ answer would replace the token with
 * today's number and quietly undo the whole arrangement.
 */

export const TOKEN_PATTERN = /\{\{\s*([a-z][a-z0-9.]*)\s*\}\}/gi;

export interface TokenDoc {
  token: string;
  describes: string;
}

/** What can be written in copy, and what each one stands for. */
export const TOKENS: TokenDoc[] = [
  { token: "{{rate.range}}", describes: "The full scale, e.g. ₹500–₹1000" },
  { token: "{{rate.lowest}}", describes: "The lowest rate on the scale" },
  { token: "{{rate.highest}}", describes: "The highest rate on the scale" },
  { token: "{{rate.student}}", describes: "The concessional rate, if there is one" },
  { token: "{{rate.band}}", describes: "The full-rate band, e.g. ₹800–₹1000" },
  { token: "{{rate.standard}}", describes: "The lowest full rate, e.g. ₹800" },
];

/** Builds the lookup a set of rates resolves to. */
export function rateValues(rates: readonly string[]): Record<string, string> {
  const amounts = rates
    .map(rateAmount)
    .filter((n): n is number => n !== null && n > 0);
  const student = rates.find(isStudentRate);
  const studentAmount = student ? rateAmount(student) : null;

  const values: Record<string, string> = {};
  if (amounts.length > 0) {
    values["rate.range"] = priceRangeOf(rates);
    values["rate.lowest"] = `₹${Math.min(...amounts)}`;
    values["rate.highest"] = `₹${Math.max(...amounts)}`;
  }
  if (studentAmount !== null) values["rate.student"] = `₹${studentAmount}`;

  /*
    The scale is two things at once: a concessional rate, and a band a working
    adult picks from. Copy that says "students pay X, everyone else Y–Z" needs
    both, and {{rate.lowest}} is the student rate — so the band gets its own
    tokens rather than being written out by hand and going stale.
  */
  const full = fullRates(rates);
  const fullAmounts = full
    .map(rateAmount)
    .filter((n): n is number => n !== null && n > 0);
  if (fullAmounts.length > 0) {
    values["rate.band"] = priceRangeOf(full);
    values["rate.standard"] = `₹${Math.min(...fullAmounts)}`;
  }
  return values;
}

/**
 * Fills tokens into one string.
 *
 * A token with nothing behind it — {{rate.student}} on a scale with no
 * concessional rate, or a name that was mistyped — is left exactly as written
 * rather than replaced with a blank. A visible {{rate.studnet}} is a typo
 * someone can see and fix; an empty gap in a sentence about money is not.
 */
export function fillTokens(
  text: string,
  values: Record<string, string>
): string {
  return text.replace(TOKEN_PATTERN, (whole, name: string) => {
    const value = values[name.toLowerCase()];
    return value ?? whole;
  });
}

/** The same substitution across every string in a structure, however nested. */
export function fillDeep<T>(value: T, values: Record<string, string>): T {
  if (typeof value === "string") return fillTokens(value, values) as unknown as T;
  if (Array.isArray(value)) {
    return value.map((item) => fillDeep(item, values)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = fillDeep(item, values);
    return out as unknown as T;
  }
  return value;
}
