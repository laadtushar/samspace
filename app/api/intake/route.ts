import { NextResponse } from "next/server";
import { Resend } from "resend";
import { addSubmission, type IntakeSubmission } from "@/lib/content";

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API);
    const data = await req.json();

    const {
      name,
      email,
      gender,
      age,
      whatsapp,
      education,
      preferredLanguage,
      concerns,
      slidingScale,
      studentConfirmed,
      scheduling,
    } = data;

    if (!name || !email || !gender || !age || !whatsapp || !concerns || !slidingScale) {
      return NextResponse.json(
        { error: "Please fill all required fields" },
        { status: 400 }
      );
    }

    // The concessional rate is only accepted alongside its confirmation, so a
    // request that bypasses the form can't quietly claim it either.
    const isStudentRate = /\(([^)]*student[^)]*)\)/i.test(slidingScale);
    if (isStudentRate && studentConfirmed !== true) {
      return NextResponse.json(
        { error: "Please confirm your student status to use the student rate" },
        { status: 400 }
      );
    }

    const submission: IntakeSubmission = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      name,
      email,
      gender,
      age,
      whatsapp,
      education,
      preferredLanguage,
      concerns,
      slidingScale,
      studentConfirmed: isStudentRate ? true : undefined,
      scheduling: scheduling || "",
    };

    // Save to Blob
    await addSubmission(submission);

    // Send confirmation to user
    await resend.emails.send({
      from: "Samvriti.Space <hello@samvritispace.com>",
      to: email,
      replyTo: "Priyankavarma785@gmail.com",
      subject: "Therapy Intake Received — Samvriti.Space",
      html: `
        <div style="font-family: 'Georgia', serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #2c3a2e;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: 600; color: #2c3a2e; margin: 0;">Samvriti.Space</h1>
            <p style="font-size: 13px; color: #8a9e8c; margin-top: 4px; letter-spacing: 2px; text-transform: uppercase;">A space to feel seen, heard, and supported</p>
          </div>
          <div style="background: #f7f3ed; border-radius: 16px; padding: 32px;">
            <p style="font-size: 16px; line-height: 1.7; margin: 0 0 16px;">Hi <strong>${name}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.7; opacity: 0.8; margin: 0 0 16px;">
              Thank you for filling out the therapy intake form. I've received your details and will review them carefully.
            </p>
            <p style="font-size: 15px; line-height: 1.7; opacity: 0.8; margin: 0 0 16px;">
              ${
                scheduling === "booked"
                  ? "Your slot is confirmed — you'll find the calendar invite in your inbox. I'll read through your form before we meet."
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
              Counselling Psychologist & Academic Mentor
            </p>
          </div>
        </div>
      `,
    });

    // Notify admin
    const adminResend = new Resend(process.env.RESEND_ADMIN_API);
    await adminResend.emails.send({
      from: "Samvriti.Space <hello@samvritispace.com>",
      to: "Priyankavarma785@gmail.com",
      replyTo: email,
      subject: `New Intake Form — ${name} (${slidingScale})`,
      html: `
        <div style="font-family: 'Georgia', serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #2c3a2e;">
          <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 24px;">New Therapy Intake</h2>
          <div style="background: #f7f3ed; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">Name</td><td>${name}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Email</td><td>${email}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Gender</td><td>${gender}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Age</td><td>${age}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">WhatsApp</td><td>${whatsapp}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Education</td><td>${education}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Language</td><td>${preferredLanguage}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Sliding Scale</td><td>${slidingScale}${
                isStudentRate ? " — student status self-confirmed ✅" : ""
              }</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Scheduling</td><td>${
                scheduling === "booked"
                  ? "Slot booked via Calendly"
                  : scheduling === "skipped"
                    ? "Skipped — needs a time"
                    : "—"
              }</td></tr>
            </table>
          </div>
          <div style="background: #f7f3ed; border-radius: 12px; padding: 24px;">
            <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #8a9e8c; margin: 0 0 8px;">Concerns</p>
            <p style="font-size: 15px; line-height: 1.7; margin: 0;">${concerns.replace(/\n/g, "<br/>")}</p>
          </div>
          <p style="font-size: 13px; color: #8a9e8c; margin-top: 24px;">Reply directly to respond to ${name}.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Intake form error:", error);
    return NextResponse.json(
      { error: "Failed to submit form" },
      { status: 500 }
    );
  }
}
