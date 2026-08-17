import type { DashboardSubmission } from "@/lib/practice";
import type { IntakeSubmission } from "@/lib/content";

/**
 * Assembling the submissions list from both places one can live.
 *
 * A submission is written to blob storage first and to the database second, and
 * the second write is deliberately non-fatal — an unreachable database must not
 * cost someone their enquiry. Reading only the database undoes exactly the
 * safety that buys: the record survives the failure and then never appears on
 * screen, so nobody replies to it. The only trace is a log line.
 *
 * So the dashboard reads both and merges. The rule it exists to keep is narrow
 * and worth stating plainly: the screen can never show fewer records than were
 * actually stored, whichever store is having a bad day.
 */

export type ViewSubmission = DashboardSubmission;

/**
 * How long one store gets to answer before it counts as unavailable.
 *
 * A store that hangs is worse than one that errors: the request waits, the
 * dashboard spins, and on Hobby the platform kills the function at ten seconds
 * with nothing useful to show for it. Observed with blob storage, whose client
 * retries a bad host rather than failing. Six seconds is far longer than either
 * store needs and still leaves room to render.
 */
export const STORE_TIMEOUT_MS = 6000;

/**
 * Resolves to null if the promise has not settled in time.
 *
 * Null is the same signal a rejection gives, and it means the same thing to the
 * caller: this store cannot be trusted to be complete, so say so.
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

/** Which store could not be read. Empty when both answered. */
export type MissingSource = "database" | "archive";

export interface SubmissionsView {
  submissions: ViewSubmission[];
  /**
   * Stores that failed. Non-empty means the list below may be short, and the
   * dashboard has to say so — silently showing less is the failure this whole
   * module exists to prevent.
   */
  unavailable: MissingSource[];
}

/** Prefers a real value over a blank one, whichever side it came from. */
function firstNonEmpty(preferred: string, fallback: string): string {
  return preferred.trim() === "" ? fallback : preferred;
}

/** A blob record in the shape the dashboard uses. */
function fromArchive(s: IntakeSubmission): ViewSubmission {
  return {
    id: s.id,
    timestamp: s.timestamp,
    name: s.name ?? "",
    email: s.email ?? "",
    gender: s.gender ?? "",
    age: s.age ?? "",
    whatsapp: s.whatsapp ?? "",
    education: s.education ?? "",
    preferredLanguage: s.preferredLanguage ?? "",
    concerns: s.concerns ?? "",
    slidingScale: s.slidingScale ?? "",
    studentConfirmed: Boolean(s.studentConfirmed),
    scheduling: s.scheduling ?? "",
    // Only the database knows which client a submission was attached to.
    clientId: null,
  };
}

/**
 * Combines one record held in both stores.
 *
 * The database wins, because it is the copy the practitioner's own edits hang
 * off and the only one carrying clientId. Blank fields fall back to the archive
 * rather than staying blank: the two copies should be identical, and where they
 * are not, showing the value that exists somewhere beats showing nothing.
 */
function reconcile(db: ViewSubmission, archive: ViewSubmission): ViewSubmission {
  return {
    ...db,
    name: firstNonEmpty(db.name, archive.name),
    email: firstNonEmpty(db.email, archive.email),
    gender: firstNonEmpty(db.gender, archive.gender),
    age: firstNonEmpty(db.age, archive.age),
    whatsapp: firstNonEmpty(db.whatsapp, archive.whatsapp),
    education: firstNonEmpty(db.education, archive.education),
    preferredLanguage: firstNonEmpty(db.preferredLanguage, archive.preferredLanguage),
    concerns: firstNonEmpty(db.concerns, archive.concerns),
    slidingScale: firstNonEmpty(db.slidingScale, archive.slidingScale),
    scheduling: firstNonEmpty(db.scheduling, archive.scheduling),
    studentConfirmed: db.studentConfirmed || archive.studentConfirmed,
  };
}

/**
 * Merges what both stores returned into one list, newest first.
 *
 * Pass null for a store that could not be read — which is not the same as a
 * store that answered with nothing, and the difference is the whole point. An
 * empty array means "there is genuinely nothing here"; null means "this cannot
 * be trusted to be complete", and the caller is told so.
 */
export function mergeSubmissions(
  fromDatabase: ViewSubmission[] | null,
  fromBlob: IntakeSubmission[] | null
): SubmissionsView {
  const unavailable: MissingSource[] = [];
  if (fromDatabase === null) unavailable.push("database");
  if (fromBlob === null) unavailable.push("archive");

  const byId = new Map<string, ViewSubmission>();

  // Archive first so a database row lands on top of it rather than under.
  for (const record of fromBlob ?? []) {
    if (!record?.id) continue;
    byId.set(record.id, fromArchive(record));
  }

  for (const record of fromDatabase ?? []) {
    if (!record?.id) continue;
    const existing = byId.get(record.id);
    byId.set(record.id, existing ? reconcile(record, existing) : record);
  }

  const submissions = [...byId.values()].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp)
  );

  return { submissions, unavailable };
}
