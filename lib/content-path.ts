/**
 * Addressing one field inside site content.
 *
 * The audit reports a path — "faq.items[1].answer" — and restoring the built-in
 * wording means writing to exactly that field and nothing else. Both sides of
 * that come from outside: a path arrives over HTTP, so it is parsed rather than
 * trusted, and a key like __proto__ is rejected before it can be used to reach
 * anything but the content object.
 */

export type PathSegment = string | number;

/** Keys are plain identifiers. Anything else is not a field this owns. */
const KEY = /^[A-Za-z][A-Za-z0-9_]*$/;
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Splits "faq.items[1].answer" into ["faq", "items", 1, "answer"].
 *
 * Returns null for anything that is not that shape, so a caller has one thing to
 * check rather than a list of ways a path can be wrong.
 */
export function parsePath(path: unknown): PathSegment[] | null {
  if (typeof path !== "string" || path.length === 0 || path.length > 200) return null;

  const segments: PathSegment[] = [];
  for (const part of path.split(".")) {
    const match = part.match(/^([A-Za-z][A-Za-z0-9_]*)((?:\[\d{1,4}\])*)$/);
    if (!match) return null;
    const [, key, indices] = match;
    if (!KEY.test(key) || FORBIDDEN.has(key)) return null;
    segments.push(key);
    for (const [, digits] of indices.matchAll(/\[(\d{1,4})\]/g)) {
      segments.push(Number(digits));
    }
  }
  return segments.length > 0 ? segments : null;
}

/** The value at a path, or undefined when the path does not lead anywhere. */
export function valueAtPath(root: unknown, segments: readonly PathSegment[]): unknown {
  let current: unknown = root;
  for (const segment of segments) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment >= current.length) return undefined;
      current = current[segment];
      continue;
    }
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * A copy of the structure with one field replaced.
 *
 * Copies only the containers along the path and shares the rest, and returns
 * null rather than creating anything: a path that does not already exist is a
 * caller with a stale path, not a field to invent.
 */
export function withValueAtPath<T>(
  root: T,
  segments: readonly PathSegment[],
  value: unknown
): T | null {
  if (segments.length === 0) return null;
  const [head, ...rest] = segments;

  if (typeof head === "number") {
    if (!Array.isArray(root) || head >= root.length) return null;
    const next =
      rest.length === 0 ? value : withValueAtPath(root[head], rest, value);
    if (rest.length > 0 && next === null) return null;
    const copy = [...root];
    copy[head] = next;
    return copy as unknown as T;
  }

  if (!root || typeof root !== "object" || Array.isArray(root)) return null;
  if (!Object.prototype.hasOwnProperty.call(root, head)) return null;
  const record = root as Record<string, unknown>;
  const next = rest.length === 0 ? value : withValueAtPath(record[head], rest, value);
  if (rest.length > 0 && next === null) return null;
  return { ...record, [head]: next } as unknown as T;
}
