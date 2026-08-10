import { NextResponse } from "next/server";
import { isLikelyBot } from "@/lib/bot-check";
import { log, newRef } from "@/lib/log";
import { contactSchema, firstIssue } from "@/lib/validation";
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

export async function POST(req: Request) {
  const ref = newRef();
  log.info("contact.received", { ref });

  if (!isSameOrigin(req)) {
    log.warn("contact.rejected", {
      ref,
      reason: "cross_origin",
      origin: req.headers.get("origin"),
      host: req.headers.get("host"),
    });
    return NextResponse.json(
      { error: "This request didn't come from the site. Please reload and try again.", ref },
      { status: 403 }
    );
  }

  // BotID classifies the caller without asking a real person to solve anything.
  // It fails open when unavailable, so the rate limiter below is the floor.
  if (await isLikelyBot(ref)) {
    log.warn("contact.rejected", { ref, reason: "bot" });
    return NextResponse.json(
      { error: "We couldn't verify this request. Please reload the page and try again.", ref },
      { status: 403 }
    );
  }

  const limited = rateLimit(`contact:${clientKey(req)}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    log.warn("contact.rejected", { ref, reason: "rate_limited" });
    return NextResponse.json(
      { error: "Too many messages sent. Please try again later.", ref },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    log.warn("contact.rejected", { ref, reason: "malformed_json" });
    return NextResponse.json({ error: "Invalid request", ref }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    log.warn("contact.rejected", {
      ref,
      reason: "validation",
      fields: parsed.error.issues.map((i) => i.path.join(".")).join(","),
    });
    return NextResponse.json({ error: firstIssue(parsed.error), ref }, { status: 400 });
  }
  const { name, email, message } = parsed.data;

  // The therapist's copy is sent first and separately: the acknowledgement goes
  // to an address a stranger supplied, so it must never be the thing that
  // decides whether the enquiry itself got through.
  const notified = await sendEmail({
    apiKey: process.env.RESEND_ADMIN_API || process.env.RESEND_API,
    to: THERAPIST_EMAIL,
    replyTo: email,
    subject: escSubject(`New inquiry from ${name} — Samvriti.Space`),
    html: emailShell(`
      <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 24px;">New Session Inquiry</h2>
      <div style="background: #f7f3ed; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px;"><strong>Name:</strong> ${esc(name)}</p>
        <p style="margin: 0 0 8px;"><strong>Email:</strong> ${esc(email)}</p>
      </div>
      <div style="background: #f7f3ed; border-radius: 12px; padding: 24px;">
        <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #8a9e8c; margin: 0 0 8px;">Message</p>
        <p style="font-size: 15px; line-height: 1.7; margin: 0;">${escMultiline(message)}</p>
      </div>
      <p style="font-size: 13px; color: #8a9e8c; margin-top: 24px;">
        You can reply directly to this email to respond to ${esc(name)}.
      </p>
    `),
  });

  if (!notified.sent) {
    log.error("contact.therapist_email_failed", { ref });
    return NextResponse.json(
      { error: "Your message couldn't be sent. Please email me directly.", ref },
      { status: 502 }
    );
  }

  // Acknowledgement to the sender. No cc to the therapist — she already has her
  // own copy above, and cc'ing her on a message addressed to an arbitrary
  // stranger turned this endpoint into a way to flood her inbox.
  await sendEmail({
    apiKey: process.env.RESEND_API,
    to: email,
    replyTo: THERAPIST_EMAIL,
    subject: "We received your message — Samvriti.Space",
    html: emailShell(`
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 28px; font-weight: 600; color: #2c3a2e; margin: 0;">Samvriti.Space</h1>
        <p style="font-size: 13px; color: #8a9e8c; margin-top: 4px; letter-spacing: 2px; text-transform: uppercase;">A space to feel seen, heard, and supported</p>
      </div>
      <div style="background: #f7f3ed; border-radius: 16px; padding: 32px; margin-bottom: 24px;">
        <p style="font-size: 16px; line-height: 1.7; color: #2c3a2e; margin: 0 0 16px;">
          Hi <strong>${esc(name)}</strong>,
        </p>
        <p style="font-size: 15px; line-height: 1.7; color: #2c3a2e; opacity: 0.8; margin: 0 0 16px;">
          Thank you for reaching out. I've received your message and will get back to you within <strong>24 hours</strong>.
        </p>
        <p style="font-size: 15px; line-height: 1.7; color: #2c3a2e; opacity: 0.8; margin: 0;">
          In the meantime, please know that taking this step is itself a sign of strength.
        </p>
      </div>
      <div style="background: #2c3a2e; border-radius: 16px; padding: 24px; color: #f7f3ed; margin-bottom: 24px;">
        <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.5; margin: 0 0 8px;">Your message</p>
        <p style="font-size: 14px; line-height: 1.6; opacity: 0.85; margin: 0;">${escMultiline(message)}</p>
      </div>
      <div style="text-align: center; padding-top: 16px; border-top: 1px solid #8a9e8c30;">
        <p style="font-size: 13px; color: #8a9e8c; margin: 0;">
          Warm regards,<br/>
          <strong style="color: #2c3a2e;">Priyanka Varma</strong><br/>
          Counselling Psychologist &amp; Academic Mentor
        </p>
      </div>
    `),
  });

  log.info("contact.completed", { ref });
  return NextResponse.json({ success: true, ref });
}
