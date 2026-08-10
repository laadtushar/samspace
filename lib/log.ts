/**
 * Structured logging.
 *
 * Every request that matters gets a short reference, and every outcome — the
 * accepted ones as well as each distinct rejection — is logged under it. The
 * reference is handed back to the caller on failure, so a person saying "it
 * said try again" can quote something that pins down the exact request instead
 * of leaving anyone to guess which check refused it.
 *
 * Lines are JSON so Vercel's log search can filter on `event`.
 *
 * Nothing here may carry personal data. These logs have a broader and
 * longer-lived audience than the encrypted store does, so names, emails, phone
 * numbers and anything a person wrote about themselves stay out. Field
 * *names* and lengths are fine; field values are not.
 */

type Level = "info" | "warn" | "error";

export interface LogFields {
  [key: string]: string | number | boolean | null | undefined;
}

function emit(level: Level, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/** Short, quotable reference for one request. */
export function newRef(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** Describes an error without leaking whatever it was carrying. */
export function errorFields(error: unknown): LogFields {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }
  return { errorName: "Unknown", errorMessage: String(error).slice(0, 200) };
}
