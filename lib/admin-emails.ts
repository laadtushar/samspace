import { sendEmail, esc, emailShell } from "@/lib/email";

/**
 * The two messages the admin login flow sends.
 *
 * Both carry a working credential, so both say plainly what to do if it was not
 * asked for. Neither includes anything about clients: these land in an inbox
 * that is not the practice's own, and a login notification is not a place to
 * mention the people being treated.
 */

function siteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);
  return (configured ?? "https://samvritispace.com").replace(/\/$/, "");
}

const NOTE_STYLE =
  "font-size: 13px; line-height: 1.7; color: #8a9e8c; margin-top: 24px;";

/** The six-digit second factor. */
export async function sendLoginCode(args: {
  to: string;
  name: string;
  code: string;
  minutes: number;
}): Promise<{ sent: boolean; error?: string }> {
  return sendEmail({
    apiKey: process.env.RESEND_API,
    to: args.to,
    subject: `${args.code} is your Samvriti.Space sign-in code`,
    html: emailShell(`
      <p style="font-size: 16px; line-height: 1.7;">Hi ${esc(args.name)},</p>
      <p style="font-size: 15px; line-height: 1.7; opacity: 0.85;">
        Here is the code to finish signing in to the dashboard:
      </p>
      <p style="font-size: 34px; letter-spacing: 8px; font-weight: 600;
                margin: 24px 0; color: #2c3a2e; font-family: monospace;">
        ${esc(args.code)}
      </p>
      <p style="font-size: 15px; line-height: 1.7; opacity: 0.85;">
        It expires in ${esc(args.minutes)} minutes and can be used once.
      </p>
      <p style="${NOTE_STYLE}">
        If you did not just try to sign in, someone else has your password.
        Change it as soon as you can — this code alone will not let them in.
      </p>
    `),
  });
}

/** The invitation link that lets someone set their own password. */
export async function sendAdminInvite(args: {
  to: string;
  name: string;
  invitedBy: string;
  token: string;
  expiresAt: Date;
}): Promise<{ sent: boolean; error?: string }> {
  const link = `${siteUrl()}/admin/invite?token=${encodeURIComponent(args.token)}`;
  const expires = args.expiresAt.toLocaleString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

  return sendEmail({
    apiKey: process.env.RESEND_API,
    to: args.to,
    subject: "You have been added to the Samvriti.Space dashboard",
    html: emailShell(`
      <p style="font-size: 16px; line-height: 1.7;">Hi ${esc(args.name)},</p>
      <p style="font-size: 15px; line-height: 1.7; opacity: 0.85;">
        ${esc(args.invitedBy)} has given you access to the Samvriti.Space admin
        dashboard. Choose a password to finish setting up your account:
      </p>
      <p style="margin: 28px 0;">
        <a href="${esc(link)}"
           style="background: #2c3a2e; color: #f6f2e9; text-decoration: none;
                  padding: 14px 26px; border-radius: 12px; font-size: 15px;
                  display: inline-block;">
          Set up my account
        </a>
      </p>
      <p style="font-size: 13px; line-height: 1.7; opacity: 0.7; word-break: break-all;">
        Or paste this into your browser:<br/>${esc(link)}
      </p>
      <p style="font-size: 15px; line-height: 1.7; opacity: 0.85;">
        The link works once and expires on ${esc(expires)}. After that, ask for
        a new one.
      </p>
      <p style="${NOTE_STYLE}">
        The dashboard holds client records, so sign in only on a device that is
        yours and locked. If you were not expecting this, ignore it and tell
        ${esc(args.invitedBy)} — the link does nothing until it is used.
      </p>
    `),
  });
}
