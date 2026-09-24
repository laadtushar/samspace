import { waitUntil } from "@vercel/functions";
import { sendEmail, emailShell, esc, escSubject } from "@/lib/email";
import type { LogFields } from "@/lib/log";

/**
 * Telling someone when the site fails.
 *
 * Every error-level log line used to go to stdout and nowhere else, so an
 * intake that could not be stored — a person who asked for help and was never
 * seen — surfaced only if somebody happened to search the logs. This sends the
 * same line as an email.
 *
 * Opt-in: nothing is sent unless ALERT_EMAIL is set. It carries exactly what
 * the log line carries — event name, time and fields — and the logger's own
 * rule already keeps personal data out of those.
 *
 * Throttled per event, so a database outage produces one email per window
 * rather than one per request. The window lives in memory, which means each
 * running instance keeps its own; an outage spread across several instances
 * can send a few, never a flood.
 */

const DEFAULT_THROTTLE_MINUTES = 30;
const lastSent = new Map<string, number>();

export function alertRecipient(): string | null {
  const to = process.env.ALERT_EMAIL?.trim();
  return to ? to : null;
}

function throttleMs(): number {
  const minutes = Number(process.env.ALERT_THROTTLE_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_THROTTLE_MINUTES) * 60_000;
}

/** Whether this event may alert now; claims the slot when it may. */
export function shouldAlert(event: string, now = Date.now()): boolean {
  if (!alertRecipient()) return false;
  const last = lastSent.get(event);
  if (last !== undefined && now - last < throttleMs()) return false;
  lastSent.set(event, now);
  return true;
}

export function alertMessage(event: string, at: string, fields: LogFields) {
  const rows = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(key)}</td><td style="padding:4px 0"><code>${esc(value)}</code></td></tr>`
    )
    .join("");
  return {
    subject: escSubject(`Site error: ${event}`),
    html: emailShell(
      `<p><strong>${esc(event)}</strong> at ${esc(at)}</p>` +
        (rows ? `<table>${rows}</table>` : "") +
        `<p style="color:#666">Further <code>${esc(event)}</code> errors are held back for ${
          throttleMs() / 60_000
        } minutes. The full trail is in the Vercel logs under this event name.</p>`
    ),
  };
}

/** Fire-and-forget. Never throws, never blocks the request that failed. */
export function raiseAlert(event: string, at: string, fields: LogFields): void {
  if (!shouldAlert(event)) return;
  const to = alertRecipient() as string;
  const { subject, html } = alertMessage(event, at, fields);
  const sending = sendEmail({
    apiKey: process.env.RESEND_ADMIN_API || process.env.RESEND_API,
    to,
    subject,
    html,
  }).catch(() => undefined);
  try {
    // Keeps the function alive until the email has left, on platforms that
    // freeze a function once its response is sent.
    waitUntil(sending);
  } catch {
    // Outside a request (a script, a test): the promise is already running.
  }
}

/** Tests only. */
export function resetAlertThrottle(): void {
  lastSent.clear();
}
