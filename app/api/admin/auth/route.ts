import { NextResponse } from "next/server";
import {
  verifyPassword,
  startLegacySession,
  endSession,
  currentAdmin,
  legacyLoginAllowed,
  recordFailedLogin,
  clearFailedLogins,
  loginBlockedFor,
} from "@/lib/auth";
import { authenticate, issueLoginCode, LOGIN_CODE_TTL_MS } from "@/lib/admin-users";
import { sendLoginCode } from "@/lib/admin-emails";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Shown instead of the address a code went to: enough to recognise, not to learn. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "your email";
  const head = user.slice(0, 1);
  const tail = user.length > 2 ? user.slice(-1) : "";
  return `${head}${"•".repeat(Math.max(3, user.length - 2))}${tail}@${domain}`;
}

const TOO_MANY = "Too many attempts. Try again shortly.";
// One message for every kind of failure, so this endpoint cannot be used to
// find out which addresses have accounts.
const REJECTED = "Invalid email or password";

/**
 * Step one of signing in.
 *
 * With accounts in place this checks an email and password and then emails a
 * six-digit code; no session exists until that code comes back. Before any
 * account exists it accepts the environment password directly, because there
 * is no address to send a code to yet.
 */
export async function POST(req: Request) {
  const ref = newRef();
  const key = clientKey(req);

  const blockedFor = loginBlockedFor(key);
  if (blockedFor > 0) {
    log.warn("admin.login.blocked", { ref });
    return NextResponse.json(
      { error: TOO_MANY },
      { status: 429, headers: { "Retry-After": String(Math.ceil(blockedFor / 1000)) } }
    );
  }

  // A second, coarser ceiling so a single source can't churn attempts even
  // before it trips the lockout.
  const limited = rateLimit(`login:${key}`, { limit: 10, windowMs: 60_000 });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: TOO_MANY },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const bootstrap = await legacyLoginAllowed();

  // ─── Bootstrap: the shared password, only while no account exists ───
  if (bootstrap && !body.email) {
    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Server misconfigured — ADMIN_PASSWORD not set" },
        { status: 500 }
      );
    }
    if (!verifyPassword(body.password)) {
      recordFailedLogin(key);
      log.warn("admin.login.rejected", { ref, mode: "bootstrap" });
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    clearFailedLogins(key);
    startLegacySession();
    log.info("admin.login.ok", { ref, mode: "bootstrap" });
    return NextResponse.json({ success: true, mode: "bootstrap" });
  }

  // ─── Accounts ───────────────────────────────────
  let user;
  try {
    user = await authenticate(body.email, body.password);
  } catch (error) {
    log.error("admin.login.failed", { ref, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not sign you in just now.", ref },
      { status: 500 }
    );
  }

  if (!user) {
    recordFailedLogin(key);
    log.warn("admin.login.rejected", { ref, mode: "account" });
    return NextResponse.json({ error: REJECTED }, { status: 401 });
  }

  try {
    const { challengeId, code } = await issueLoginCode(user.id);
    const minutes = Math.round(LOGIN_CODE_TTL_MS / 60_000);
    const result = await sendLoginCode({
      to: user.email,
      name: user.name,
      code,
      minutes,
    });

    if (!result.sent) {
      // The password was right, so this is our failure, not theirs. Say so
      // rather than leaving them retyping a correct password.
      log.error("admin.login.code_unsent", { ref, userId: user.id });
      return NextResponse.json(
        {
          error:
            "Your password was accepted, but the code could not be emailed. Try again in a moment.",
          ref,
        },
        { status: 502 }
      );
    }

    clearFailedLogins(key);
    log.info("admin.login.code_sent", { ref, userId: user.id });
    return NextResponse.json({
      mfaRequired: true,
      challengeId,
      sentTo: maskEmail(user.email),
      expiresInMinutes: minutes,
    });
  } catch (error) {
    log.error("admin.login.failed", { ref, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not sign you in just now.", ref },
      { status: 500 }
    );
  }
}

/** Log out. */
export async function DELETE() {
  await endSession();
  return NextResponse.json({ success: true });
}

/**
 * Lets the dashboard restore a session after a refresh, and tells the login
 * screen which form to show — an email and password, or the bootstrap password.
 */
export async function GET() {
  const identity = await currentAdmin();
  let mode: "accounts" | "bootstrap" = "accounts";
  try {
    mode = (await legacyLoginAllowed()) ? "bootstrap" : "accounts";
  } catch {
    // Fall back to asking for an email; a wrong guess here only picks a form.
  }

  return NextResponse.json({
    authenticated: identity !== null,
    mode,
    user: identity
      ? {
          name: identity.name,
          email: identity.email,
          role: identity.role,
          legacy: identity.legacy,
        }
      : null,
  });
}
