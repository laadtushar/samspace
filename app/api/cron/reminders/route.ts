import { NextResponse } from "next/server";
import { sendEmail, THERAPIST_EMAIL, esc } from "@/lib/email";
import { dbConfigured } from "@/lib/db";
import { sessionsNeedingReminder, markReminderSent } from "@/lib/practice";
import { log, newRef, errorFields } from "@/lib/log";
import { formatSessionTime } from "@/lib/session-emails";

export const dynamic = "force-dynamic";

/**
 * How far ahead a session gets a reminder.
 *
 * The run happens once a day, so this window has to be wider than a day or a
 * session in tomorrow evening would fall between two runs and be reminded
 * about on the morning it happens. At 36 hours every session is caught by the
 * run before it, which is the day before for anything not booked at the last
 * minute. Reminding twice is prevented by reminder_sent_at, not by the window.
 */
const HOURS_AHEAD = 36;

/**
 * Sends a reminder for each session starting in the next day and a half.
 *
 * Run on a schedule by Vercel Cron. Vercel signs its own cron requests with
 * CRON_SECRET; anything else is refused, because an open endpoint that sends
 * mail on demand is a way to have mail sent in your name.
 *
 * A send failure deliberately leaves the session unmarked so the next run tries
 * again. Sending twice is an annoyance; not sending at all is a missed session.
 */
function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  const ref = newRef();

  if (!authorised(req)) {
    log.warn("reminders.rejected", { ref });
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  if (!dbConfigured()) {
    return NextResponse.json({ sent: 0, skipped: "no database" });
  }

  let sent = 0;
  let failed = 0;

  try {
    const due = await sessionsNeedingReminder(HOURS_AHEAD);
    log.info("reminders.due", { ref, count: due.length });

    for (const session of due) {
      const when = formatSessionTime(session.starts_at);

      const result = await sendEmail({
        apiKey: process.env.RESEND_API,
        to: session.client_email,
        replyTo: THERAPIST_EMAIL,
        // She sees every message that goes out in her name.
        bcc: THERAPIST_EMAIL,
        // Not "tomorrow": the window reaches far enough ahead that it would
        // sometimes be a day off, and the date is right there in the subject.
        subject: `Your upcoming session — ${when}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #2c3a2e;">
            <p style="font-size: 16px; line-height: 1.7;">Hi ${esc(session.client_name)},</p>
            <p style="font-size: 15px; line-height: 1.7; opacity: 0.85;">
              A gentle reminder that we have a session on <strong>${esc(when)}</strong>.
              It runs for about 50 minutes and is held online.
            </p>
            <p style="font-size: 15px; line-height: 1.7; opacity: 0.85;">
              If you need to move it, just reply to this email — no explanation needed.
            </p>
            <p style="font-size: 13px; color: #8a9e8c; margin-top: 28px;">
              Warm regards,<br/><strong style="color:#2c3a2e;">Priyanka Varma</strong><br/>
              Samvriti.Space
            </p>
          </div>
        `,
      });

      if (result.sent) {
        // Marked only after a successful send, so a failure retries next run.
        await markReminderSent(session.id);
        sent += 1;
      } else {
        failed += 1;
        log.error("reminders.send_failed", { ref, id: session.id });
      }
    }

    log.info("reminders.finished", { ref, sent, failed });
    return NextResponse.json({ sent, failed });
  } catch (error) {
    log.error("reminders.failed", { ref, ...errorFields(error) });
    return NextResponse.json(
      { error: "Reminder run failed", ref },
      { status: 500 }
    );
  }
}
