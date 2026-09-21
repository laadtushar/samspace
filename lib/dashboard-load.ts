/**
 * Three independent loads, three independent outcomes.
 *
 * The dashboard fetched its submissions, its content and its posts with
 * `Promise.all`, so a single rejection took the whole result with it: every tab
 * rendered empty and one banner explained it. That is what a paused blob store
 * looked like from the practitioner's side — the clients, the sessions and the
 * blog were all in Postgres and all readable, and none of them were shown,
 * because the one endpoint that read the failing store rejected first.
 *
 * `Promise.all` is the wrong shape for independent reads. It is for work where
 * a partial answer is worthless, and here a partial answer is most of a working
 * dashboard.
 *
 * Kept out of the component because a client component is awkward to test and
 * this is the part with the rules in it: which failures are per-section, which
 * one is the whole page, and which one means the session is gone.
 */

export type Section<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** A settled result as a section outcome, with a readable message either way. */
export function toSection<T>(
  result: PromiseSettledResult<T>,
  fallback: string
): Section<T> {
  if (result.status === "fulfilled") return { ok: true, value: result.value };

  const { reason } = result;
  const message =
    reason instanceof Error && reason.message.trim() !== ""
      ? reason.message
      : fallback;
  return { ok: false, error: message };
}

/**
 * Whether any load failed for a reason the caller recognises.
 *
 * Takes a predicate rather than a type, so this module does not need to know
 * about the component's SessionExpired. The case it exists for: an expired
 * session fails every request, and the right response is to sign the person
 * out once — not to paint three "could not load" messages over a dashboard they
 * are no longer authenticated for.
 */
export function anyRejectedWith(
  results: readonly PromiseSettledResult<unknown>[],
  match: (reason: unknown) => boolean
): boolean {
  return results.some((r) => r.status === "rejected" && match(r.reason));
}

/**
 * Whether nothing at all loaded.
 *
 * The one case that still deserves a banner across the whole page. Anything
 * less is a section problem and belongs in that section, where it sits next to
 * what is missing instead of implying the rest is missing too.
 */
export function everyFailed(
  sections: readonly Section<unknown>[]
): boolean {
  return sections.length > 0 && sections.every((s) => !s.ok);
}

/** The value if it loaded, or the fallback — so a failed section renders empty, not undefined. */
export function valueOr<T>(section: Section<T>, fallback: T): T {
  return section.ok ? section.value : fallback;
}
