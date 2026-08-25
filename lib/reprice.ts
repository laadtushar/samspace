/**
 * Rewriting a rate that is already published.
 *
 * The site's copy lives in blob storage once the dashboard has been used, and
 * `mergeContent` takes stored arrays wholesale rather than merging into them.
 * So changing a price in `defaultContent` moves the structured data and the
 * form fallbacks — everything the code owns — and leaves the sliding-scale
 * list, the services card, the FAQ answer and every published post reading the
 * old number. Those are the places a visitor actually looks.
 *
 * Editing each by hand is how one gets missed. This does the same edit
 * everywhere at once, and can say what it would touch before touching it.
 */

/** A rupee amount, and nothing else. */
export const RATE_PATTERN = /^₹\d{2,6}$/;

export interface Rewrite {
  /** Dotted path into the object, for a preview a person can read. */
  path: string;
  before: string;
  after: string;
}

export function isRate(value: unknown): value is string {
  return typeof value === "string" && RATE_PATTERN.test(value);
}

/**
 * Replaces one rupee amount with another inside a single string.
 *
 * The lookahead is what keeps ₹500 from matching the first four characters of
 * ₹5000. Without it a repricing run would quietly halve the top of the scale.
 */
export function rewriteText(text: string, from: string, to: string): string {
  const amount = from.slice(1);
  return text.replace(new RegExp(`₹${amount}(?!\\d)`, "g"), to);
}

/**
 * The same replacement across every string in a structure, however nested.
 *
 * Walking the whole object rather than naming fields is deliberate: a rate can
 * be written into any piece of copy from the dashboard, and a list of fields
 * would go stale the first time one was added.
 */
export function rewriteDeep<T>(
  value: T,
  from: string,
  to: string,
  changes: Rewrite[] = [],
  path = ""
): T {
  if (typeof value === "string") {
    const next = rewriteText(value, from, to);
    if (next !== value) changes.push({ path, before: value, after: next });
    return next as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item, i) =>
      rewriteDeep(item, from, to, changes, `${path}[${i}]`)
    ) as unknown as T;
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = rewriteDeep(item, from, to, changes, path ? `${path}.${key}` : key);
    }
    return out as unknown as T;
  }

  return value;
}

/** Rewrites a structure and reports what changed, without mutating the input. */
export function reprice<T>(
  value: T,
  from: string,
  to: string
): { value: T; changes: Rewrite[] } {
  const changes: Rewrite[] = [];
  const next = rewriteDeep(value, from, to, changes);
  return { value: next, changes };
}
