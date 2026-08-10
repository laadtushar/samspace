import { Resend } from "resend";

/**
 * Outbound email.
 *
 * Two things this module exists to guarantee:
 *
 * 1. Nothing a stranger typed reaches an HTML template unescaped. These mails
 *    are DKIM-signed by samvritispace.com and land in the therapist's inbox, so
 *    an unescaped `name` is a ready-made phishing link wearing her domain.
 *
 * 2. A failed send is never reported as a success. The Resend SDK resolves with
 *    `{ error }` rather than throwing, so an unchecked `await` silently drops
 *    mail — an expired key would mean intake notifications quietly stop
 *    arriving with nothing anywhere to say so.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes a value for interpolation into an HTML email body. */
export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Escapes, then turns newlines into breaks. Order matters — escape first. */
export function escMultiline(value: unknown): string {
  return esc(value).replace(/\r?\n/g, "<br/>");
}

/** Strips CR/LF so user input cannot inject extra headers via the subject. */
export function escSubject(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 180);
}

export const FROM_ADDRESS =
  process.env.RESEND_FROM || "Samvriti.Space <hello@samvritispace.com>";

export const THERAPIST_EMAIL =
  process.env.THERAPIST_EMAIL || "Priyankavarma785@gmail.com";

interface SendArgs {
  apiKey: string | undefined;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
}

/**
 * Sends one email, returning whether it actually went out. Never throws — the
 * caller decides whether a given message failing should fail the request.
 */
export async function sendEmail({
  apiKey,
  to,
  replyTo,
  subject,
  html,
}: SendArgs): Promise<{ sent: boolean; error?: string }> {
  if (!apiKey) {
    console.error("[email] missing API key — not sending", { subject });
    return { sent: false, error: "Email is not configured" };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: FROM_ADDRESS,
      to,
      replyTo,
      subject,
      html,
    });
    if (error) {
      // Log the failure reason, never the message body — these bodies carry PII.
      console.error("[email] send failed", { subject, error: error.message });
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[email] transport threw", {
      subject,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { sent: false, error: "Email transport failed" };
  }
}

/** Shared shell so both routes' mails look the same. */
export function emailShell(inner: string): string {
  return `
    <div style="font-family: 'Georgia', serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #2c3a2e;">
      ${inner}
    </div>
  `;
}
