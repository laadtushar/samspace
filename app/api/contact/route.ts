import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API);

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Send confirmation email to the user
    await resend.emails.send({
      from: "Samvriti.Space <hello@samvritispace.com>",
      to: email,
      cc: "Priyankavarma785@gmail.com",
      replyTo: "Priyankavarma785@gmail.com",
      subject: "We received your message — Samvriti.Space",
      html: `
        <div style="font-family: 'Georgia', serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #2c3a2e;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: 600; color: #2c3a2e; margin: 0;">Samvriti.Space</h1>
            <p style="font-size: 13px; color: #8a9e8c; margin-top: 4px; letter-spacing: 2px; text-transform: uppercase;">A space to feel seen, heard, and supported</p>
          </div>

          <div style="background: #f7f3ed; border-radius: 16px; padding: 32px; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.7; color: #2c3a2e; margin: 0 0 16px;">
              Hi <strong>${name}</strong>,
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
            <p style="font-size: 14px; line-height: 1.6; opacity: 0.85; margin: 0;">${message.replace(/\n/g, "<br/>")}</p>
          </div>

          <div style="text-align: center; padding-top: 16px; border-top: 1px solid #8a9e8c30;">
            <p style="font-size: 13px; color: #8a9e8c; margin: 0;">
              Warm regards,<br/>
              <strong style="color: #2c3a2e;">Priyanka Varma</strong><br/>
              Counselling Psychologist & Academic Mentor
            </p>
          </div>
        </div>
      `,
    });

    // Send notification email to Priyanka (admin)
    const adminResend = new Resend(process.env.RESEND_ADMIN_API);
    await adminResend.emails.send({
      from: "Samvriti.Space <hello@samvritispace.com>",
      to: "Priyankavarma785@gmail.com",
      subject: `New inquiry from ${name} — Samvriti.Space`,
      replyTo: email,
      html: `
        <div style="font-family: 'Georgia', serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #2c3a2e;">
          <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 24px;">New Session Inquiry</h2>

          <div style="background: #f7f3ed; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 0 0 8px;"><strong>Email:</strong> ${email}</p>
          </div>

          <div style="background: #f7f3ed; border-radius: 12px; padding: 24px;">
            <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #8a9e8c; margin: 0 0 8px;">Message</p>
            <p style="font-size: 15px; line-height: 1.7; margin: 0;">${message.replace(/\n/g, "<br/>")}</p>
          </div>

          <p style="font-size: 13px; color: #8a9e8c; margin-top: 24px;">
            You can reply directly to this email to respond to ${name}.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
