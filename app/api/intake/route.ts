import { NextResponse } from "next/server";
import { isLikelyBot } from "@/lib/bot-check";
import { log, newRef, errorFields } from "@/lib/log";
import { dbConfigured } from "@/lib/db";
import { recordSubmission } from "@/lib/practice";
import { getCachedContent, type IntakeSubmission } from "@/lib/content";
import { intakeSchema, firstIssue } from "@/lib/validation";
import { rateLimit, clientKey, isSameOrigin } from "@/lib/rate-limit";
import {
  esc,
  escMultiline,
  escSubject,
  sendEmail,
  emailShell,
  THERAPIST_EMAIL,
} from "@/lib/email";

export const dynamic = "force-dynamic";

/** Matches "₹500 (Student)" — the same rule the form applies client-side. */
const isStudentRate = (option: string) => /\(([^)]*student[^)]*)\)/i.test(option);

/**
 * What one store did with a submission.
 *
 * `skipped` is not a failure. It means the store is not configured here — the
 * ordinary state of a fresh clone or a local run — and only a store that was
 * asked and refused counts against the record being safe. Collapsing the two
 * would turn "no database configured" into "the submission was lost".
 */
type Attempt<T> =
  | { ok: true; value: T; skipped?: false; error?: undefined }
  | { ok: false; value?: undefined; skipped?: boolean; error?: unknown };

async function attempt<T>(run: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error };
  }
}

function skipped<T>(): Promise<Attempt<T>> {
  return Promise.resolve({ ok: false, skipped: true });
}

export async function POST(req: Request) {
  const ref = newRef();
  const started = Date.now();
  log.info("intake.received", { ref });

  if (!isSameOrigin(req)) {
    log.warn("intake.rejected", {
      ref,
      reason: "cross_origin",
      origin: req.headers.get("origin"),
      host: req.headers.get("host"),
    });
    return NextResponse.json(
      {
        error: "This request didn't come from the site. Please reload and try again.",
        ref,
      },
      { status: 403 }
    );
  }

  // BotID classifies the caller without asking a real person to solve anything.
  // It fails open when unavailable, so the rate limiter below is the floor.
  if (await isLikelyBot(ref)) {
    log.warn("intake.rejected", { ref, reason: "bot" });
    return NextResponse.json(
      {
        error: "We couldn't verify this request. Please reload the page and try again.",
        ref,
      },
      { status: 403 }
    );
  }

  // Kept deliberately loose: several people can share one IP, and turning a
  // real client away from a therapist is worse than accepting some duplicates.
  const limited = rateLimit(`intake:${clientKey(req)}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    log.warn("intake.rejected", {
      ref,
      reason: "rate_limited",
      retryAfter: limited.retryAfter,
    });
    return NextResponse.json(
      {
        error:
          "You've submitted this form several times just now. If it isn't coming through, email Priyankavarma785@gmail.com directly.",
        ref,
      },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    log.warn("intake.rejected", { ref, reason: "malformed_json" });
    return NextResponse.json({ error: "Invalid request", ref }, { status: 400 });
  }

  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) {
    // Field names only — the values are the person's own words.
    log.warn("intake.rejected", {
      ref,
      reason: "validation",
      fields: parsed.error.issues.map((i) => i.path.join(".")).join(","),
    });
    return NextResponse.json(
      { error: firstIssue(parsed.error), ref },
      { status: 400 }
    );
  }
  const data = parsed.data;

  /*
    The rate has to be one the practice actually offers.

    It arrived as free text: the schema accepted any string up to sixty
    characters, so a request that skipped the form could name any figure it
    liked and have it recorded, emailed, and treated as agreed. That was
    survivable while every rate was rupees and a person read the email — it
    stops being survivable the moment an amount means different things in
    different places.

    Checked against the scale as stored, not as displayed, and compared exactly:
    the form sends back the option it was given.
  */
  const scale = await getCachedContent()
    .then((content) => content.slidingScale)
    .catch(() => [] as string[]);

  // An empty scale means content could not be read. Refusing every booking
  // because storage hiccuped is the wrong trade; the other checks still apply.
  if (scale.length > 0 && !scale.includes(data.slidingScale)) {
    log.warn("intake.rejected", { ref, reason: "rate_not_offered" });
    return NextResponse.json(
      {
        error:
          "That rate is not one currently offered — please reload the page and choose again.",
        ref,
      },
      { status: 400 }
    );
  }

  // The concessional rate is only accepted alongside its confirmation, so a
  // request that bypasses the form cannot quietly claim it either.
  const studentRate = isStudentRate(data.slidingScale);
  if (studentRate && !data.studentConfirmed) {
    log.warn("intake.rejected", { ref, reason: "student_unconfirmed" });
    return NextResponse.json(
      { error: "Please confirm your student status to use the student rate", ref },
      { status: 400 }
    );
  }

  const submission: IntakeSubmission = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...data,
    studentConfirmed: studentRate,
  };

  /*
    One store. The submission used to be written to blob and then to Postgres,
    and for a while to either — which was the right answer while both existed
    and blob was refusing. Blob is gone now, and Postgres holds every field of a
    submission rather than a reduced copy.

    A failure here is fatal to the request, deliberately. There is nowhere else
    for the record to be, and telling someone their enquiry arrived when it did
    not is worse than asking them to try again.
  */
  const recorded = await (dbConfigured()
    ? attempt(() => recordSubmission(submission))
    : skipped<string>());

  if (recorded.ok) {
    log.info("intake.stored", {
      ref,
      id: submission.id,
      clientId: recorded.value,
    });
  } else {
    if (recorded.skipped) log.error("intake.no_database", { ref });
    else {
      log.error("intake.store_failed", {
        ref,
        id: submission.id,
        ...errorFields(recorded.error),
      });
    }
    // The one line to search for when someone says their form would not send.
    log.error("intake.unsaved", { ref, id: submission.id });
    return NextResponse.json(
      {
        error: "Something went wrong saving your form. Please try again.",
        ref,
      },
      { status: 500 }
    );
  }

  const booked = data.scheduling === "booked";

  // Both mails are sent even if one fails; the record is already safe, and the
  // therapist's copy matters more than the acknowledgement.
  const [clientResult, adminResult] = await Promise.all([
    sendEmail({
      apiKey: process.env.RESEND_API,
      to: data.email,
      replyTo: THERAPIST_EMAIL,
      subject: "Therapy Intake Received — Samvriti.Space",
      html: emailShell(`
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 600; color: #2c3a2e; margin: 0;">Samvriti.Space</h1>
          <p style="font-size: 13px; color: #8a9e8c; margin-top: 4px; letter-spacing: 2px; text-transform: uppercase;">A space to feel seen, heard, and supported</p>
        </div>
        <div style="background: #f7f3ed; border-radius: 16px; padding: 32px;">
          <p style="font-size: 16px; line-height: 1.7; margin: 0 0 16px;">Hi <strong>${esc(data.name)}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.7; opacity: 0.8; margin: 0 0 16px;">
            Thank you for filling out the therapy intake form. I've received your details and will review them carefully.
          </p>
          <p style="font-size: 15px; line-height: 1.7; opacity: 0.8; margin: 0 0 16px;">
            ${
              booked
                ? "Your slot is confirmed — the calendar invite is in your inbox. I'll read through your form before we meet."
                : "I'll reach out to you within <strong>24–48 hours</strong> to discuss next steps and schedule your first session."
            }
          </p>
          <p style="font-size: 15px; line-height: 1.7; opacity: 0.8; margin: 0;">
            Taking this step is itself a sign of courage and self-awareness. 🌿
          </p>
        </div>
        <div style="text-align: center; padding-top: 24px; border-top: 1px solid #8a9e8c30; margin-top: 24px;">
          <p style="font-size: 13px; color: #8a9e8c; margin: 0;">
            Warm regards,<br/>
            <strong style="color: #2c3a2e;">Priyanka Varma</strong><br/>
            Counselling Psychologist &amp; Academic Mentor
          </p>
        </div>
      `),
    }),
    sendEmail({
      apiKey: process.env.RESEND_ADMIN_API || process.env.RESEND_API,
      to: THERAPIST_EMAIL,
      replyTo: data.email,
      subject: escSubject(`New Intake Form — ${data.name} (${data.slidingScale})`),
      html: emailShell(`
        <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 24px;">New Therapy Intake</h2>
        <div style="background: #f7f3ed; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">Name</td><td>${esc(data.name)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Email</td><td>${esc(data.email)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Gender</td><td>${esc(data.gender)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Age</td><td>${esc(data.age)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">WhatsApp</td><td>${esc(data.whatsapp)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Education</td><td>${esc(data.education)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Language</td><td>${esc(data.preferredLanguage)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Sliding Scale</td><td>${esc(data.slidingScale)}${
              studentRate ? " — student status self-confirmed ✅" : ""
            }</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Scheduling</td><td>${
              booked
                ? "Slot booked"
                : data.scheduling === "skipped"
                  ? "Skipped — needs a time"
                  : "—"
            }</td></tr>
          </table>
        </div>
        <div style="background: #f7f3ed; border-radius: 12px; padding: 24px;">
          <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #8a9e8c; margin: 0 0 8px;">Concerns</p>
          <p style="font-size: 15px; line-height: 1.7; margin: 0;">${escMultiline(data.concerns)}</p>
        </div>
        <p style="font-size: 13px; color: #8a9e8c; margin-top: 24px;">Reply directly to respond to ${esc(data.name)}.</p>
      `),
    }),
  ]);

  if (!adminResult.sent) {
    // The submission is stored and visible in the dashboard, so this is a
    // degraded success rather than a failure the person should retry into.
    log.error("intake.therapist_email_failed", { ref, id: submission.id });
  }
  if (!clientResult.sent) {
    log.warn("intake.confirmation_email_failed", { ref, id: submission.id });
  }

  log.info("intake.completed", {
    ref,
    id: submission.id,
    ms: Date.now() - started,
    therapistNotified: adminResult.sent,
    confirmationSent: clientResult.sent,
  });

  return NextResponse.json({ success: true, ref });
}
