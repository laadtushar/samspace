import { NextResponse } from "next/server";
import { startUserSession, recordFailedLogin, loginBlockedFor, clearFailedLogins } from "@/lib/auth";
import { verifyLoginCode, findAdminById } from "@/lib/admin-users";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Step two of signing in: the emailed code.
 *
 * The code is checked against the challenge issued a moment ago, not against
 * the account, so a code cannot be replayed into a different login attempt. It
 * is consumed on success and burned after five wrong guesses — six digits is a
 * million values, which is not many if you are allowed to keep trying.
 */
export async function POST(req: Request) {
  const ref = newRef();
  const key = clientKey(req);

  const blockedFor = loginBlockedFor(key);
  if (blockedFor > 0) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(blockedFor / 1000)) } }
    );
  }

  const limited = rateLimit(`mfa:${key}`, { limit: 15, windowMs: 60_000 });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  let body: { challengeId?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof body.challengeId !== "string" || !body.challengeId) {
    return NextResponse.json({ error: "Start again from the sign-in screen." }, { status: 400 });
  }

  try {
    const result = await verifyLoginCode(body.challengeId, body.code);

    if (!result.ok) {
      recordFailedLogin(key);
      log.warn("admin.mfa.rejected", { ref, reason: result.reason });
      const message =
        result.reason === "expired"
          ? "That code has expired. Sign in again to get a new one."
          : result.reason === "exhausted"
            ? "Too many wrong codes. Sign in again to get a new one."
            : "That code is not right.";
      return NextResponse.json(
        { error: message, restart: result.reason !== "wrong" },
        { status: 401 }
      );
    }

    const user = await findAdminById(result.userId);
    if (!user || !user.active) {
      log.warn("admin.mfa.account_unusable", { ref, userId: result.userId });
      return NextResponse.json({ error: "That account cannot sign in." }, { status: 403 });
    }

    await startUserSession(user.id, req.headers.get("user-agent"));
    clearFailedLogins(key);
    log.info("admin.login.ok", { ref, mode: "account", userId: user.id });

    return NextResponse.json({
      success: true,
      user: { name: user.name, email: user.email, role: user.role, legacy: false },
    });
  } catch (error) {
    log.error("admin.mfa.failed", { ref, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not finish signing you in.", ref },
      { status: 500 }
    );
  }
}
