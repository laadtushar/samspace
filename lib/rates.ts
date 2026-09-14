/**
 * Reading and writing a sliding-scale rate.
 *
 * A rate is stored as one string — "₹500 (Student)" — because that is what the
 * form shows and what a submission records. Everything that needs the number
 * back out was pulling every digit in the string, which is right up until two
 * rates end up on one line: "₹500 (Student)  ₹600" then reads as ₹500600 and
 * the form advertises a sliding scale ending in it.
 *
 * So the number is taken from the first rupee amount and nothing else, and the
 * leftovers are reported rather than silently folded in — the dashboard uses
 * them to offer the fix.
 */

const AMOUNT = /₹\s*(\d{1,7})/g;
const LABEL = /\(([^)]*)\)/;

export interface ParsedRate {
  /** The rupee figure, or null when the entry has none. */
  amount: number | null;
  /** What is in brackets — "Student" — or "" when there is none. */
  label: string;
  /** Further amounts in the same entry: a sign two rates were run together. */
  extras: number[];
}

export function parseRate(raw: unknown): ParsedRate {
  if (typeof raw !== "string") return { amount: null, label: "", extras: [] };
  const found = [...raw.matchAll(AMOUNT)].map((m) => Number(m[1]));
  return {
    amount: found.length > 0 ? found[0] : null,
    label: raw.match(LABEL)?.[1]?.trim() ?? "",
    extras: found.slice(1),
  };
}

/** The number a rate is worth, for ordering and for the headline range. */
export function rateAmount(raw: unknown): number | null {
  return parseRate(raw).amount;
}

/** Builds the stored form back from its parts. */
export function formatRate(amount: number | string, label = ""): string {
  const digits = String(amount).replace(/\D/g, "");
  if (!digits) return "";
  const trimmed = label.trim();
  return trimmed ? `₹${digits} (${trimmed})` : `₹${digits}`;
}

/**
 * Splits an entry that holds more than one rate.
 *
 * The label, if there is one, belongs to the first amount — it is what was
 * being typed when the newline was missed.
 */
export function splitRate(raw: string): string[] {
  const { amount, label, extras } = parseRate(raw);
  if (amount === null) return [raw];
  return [formatRate(amount, label), ...extras.map((n) => formatRate(n))];
}

/** True when this rate is the concessional one. Mirrors the intake form. */
export function isStudentRate(raw: unknown): boolean {
  return typeof raw === "string" && /\(([^)]*student[^)]*)\)/i.test(raw);
}

/** The headline range, ignoring anything that is not a real amount. */
export function priceRangeOf(rates: readonly string[]): string {
  const amounts = rates
    .map(rateAmount)
    .filter((n): n is number => n !== null && n > 0);
  if (amounts.length === 0) return "";
  return `₹${Math.min(...amounts)}–₹${Math.max(...amounts)}`;
}
