import type { DashboardSubmission } from "@/lib/practice";

/**
 * The submissions list, as the dashboard receives it.
 *
 * This module used to reconcile two stores. A submission was written to the
 * blob archive and then to Postgres, so the list had to be assembled from both
 * or a record that survived one store's bad day would never reach the screen.
 *
 * Blob is gone. Postgres holds every field of a submission rather than a
 * reduced copy, so there is one list and nothing to merge — but the rule the
 * merging existed to keep still holds and still needs saying: the screen must
 * never show fewer records than were stored without saying that is what it is
 * doing. A short list that looks complete is the failure; missing rows are only
 * the symptom.
 */

export type ViewSubmission = DashboardSubmission;

/**
 * How long the store gets to answer before it counts as unavailable.
 *
 * A store that hangs is worse than one that errors: the request waits, the
 * dashboard spins, and on Hobby the platform kills the function at ten seconds
 * with nothing useful to show for it. Six seconds is far longer than the
 * database needs and still leaves room to render.
 */
export const STORE_TIMEOUT_MS = 6000;

/**
 * Resolves to null if the promise has not settled in time.
 *
 * Null is the same signal a rejection gives, and it means the same thing to the
 * caller: this cannot be trusted to be complete, so say so.
 */
export function withTimeout<T>(
  work: Promise<T>,
  ms: number = STORE_TIMEOUT_MS
): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

/** Which store could not be read. Empty when it answered. */
export type MissingSource = "database";

export interface SubmissionsView {
  submissions: ViewSubmission[];
  /**
   * Non-empty means the list may be short and the dashboard has to say so.
   * Kept as a list rather than a boolean because it is what the dashboard
   * already renders, and because "which store" is the useful thing to log.
   */
  unavailable: MissingSource[];
}

/**
 * The stored submissions as a view, newest first.
 *
 * Pass null for a read that failed — which is not the same as a read that
 * returned nothing, and the difference is the whole point. An empty array means
 * "there is genuinely nothing here"; null means "this cannot be trusted to be
 * complete", and the caller is told so rather than shown a confident blank.
 */
export function submissionsView(
  fromDatabase: ViewSubmission[] | null
): SubmissionsView {
  if (fromDatabase === null) return { submissions: [], unavailable: ["database"] };

  const submissions = fromDatabase
    .filter((record) => Boolean(record?.id))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return { submissions, unavailable: [] };
}
