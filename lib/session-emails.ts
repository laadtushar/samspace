import { sendEmail, THERAPIST_EMAIL, esc } from "@/lib/email";

/**
 * Messages about a booked session.
 *
 * Every one of these is blind-copied to the practitioner. She books the session
 * from a dashboard that tells her it worked, which is not the same as knowing
 * the client was actually told — the copy in her inbox is the evidence, and it
 * is also the thing she can forward or refer back to.
 *
 * Times are rendered in the practice's timezone rather than the server's. A
 * session is at half five in Pune regardless of which region ran the function.
 */

const PRACTICE_TIMEZONE = "Asia/Kolkata";

export function formatSessionTime(startsAt: string): string {
  return new Date(startsAt).toLocaleString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: PRACTICE_TIMEZONE,
  });
}

function shell(body: string): string {
  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #2c3a2e;">
      ${body}
      <p style="font-size: 13px; color: #8a9e8c; margin-top: 28px; padding-top: 16px; border-top: 1px solid #8a9e8c30;">
        Warm regards,<br/>
        <strong style="color:#2c3a2e;">Priyanka Varma</strong><br/>
        Samvriti.Space · Counselling Psychologist
      </p>
    </div>
  `;
}

interface SessionMessage {
  clientName: string;
  clientEmail: string;
  startsAt: string;
}

/**
 * Confirms a newly booked session.
 *
 * Without this, booking is silent: the person filled in a form, was told they
 * would hear back, and then nothing arrives until the reminder the day before —
 * which for a session booked a fortnight out is a fortnight of silence.
 */
export async function sendBookingConfirmation({
  clientName,
  clientEmail,
  startsAt,
}: SessionMessage): Promise<{ sent: boolean; error?: string }> {
  const when = formatSessionTime(startsAt);

  return sendEmail({
    apiKey: process.env.RESEND_API,
    to: clientEmail,
    replyTo: THERAPIST_EMAIL,
    bcc: THERAPIST_EMAIL,
    subject: `Your session is booked — ${when}`,
    html: shell(`
      <p style="font-size: 16px; line-height: 1.7;">Hi ${esc(clientName)},</p>
      <p style="font-size: 15px; line-height: 1.7; opacity: 0.85;">
        Your session is confirmed for <strong>${esc(when)}</strong>. It runs for
        about 50 minutes and is held online — I'll send the link before we meet.
      </p>
      <p style="font-size: 15px; line-height: 1.7; opacity: 0.85;">
        If that time stops working, just reply to this email. Moving a session is
        completely fine and needs no explanation.
      </p>
      <p style="font-size: 15px; line-height: 1.7; opacity: 0.85;">
        I'm glad you're coming. 🌿
      </p>
    `),
  });
}

/** Tells someone a session is no longer happening. */
export async function sendCancellationNotice({
  clientName,
  clientEmail,
  startsAt,
}: SessionMessage): Promise<{ sent: boolean; error?: string }> {
  const when = formatSessionTime(startsAt);

  return sendEmail({
    apiKey: process.env.RESEND_API,
    to: clientEmail,
    replyTo: THERAPIST_EMAIL,
    bcc: THERAPIST_EMAIL,
    subject: `Your session on ${when} has been cancelled`,
    html: shell(`
      <p style="font-size: 16px; line-height: 1.7;">Hi ${esc(clientName)},</p>
      <p style="font-size: 15px; line-height: 1.7; opacity: 0.85;">
        I've had to cancel our session on <strong>${esc(when)}</strong>. I'm sorry
        for the change.
      </p>
      <p style="font-size: 15px; line-height: 1.7; opacity: 0.85;">
        Reply to this email and we'll find another time that suits you.
      </p>
    `),
  });
}
