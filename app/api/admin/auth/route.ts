import { NextResponse } from "next/server";
import {
  verifyPassword,
  startSession,
  endSession,
  isAuthenticated,
  recordFailedLogin,
  clearFailedLogins,
  loginBlockedFor,
} from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Log in: exchange the password for a signed, httpOnly session cookie. */
export async function POST(req: Request) {
  const key = clientKey(req);

  const blockedFor = loginBlockedFor(key);
  if (blockedFor > 0) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(blockedFor / 1000)) } }
    );
  }

  // A second, coarser ceiling so a single source can't churn attempts even
  // before it trips the lockout.
  const limited = rateLimit(`login:${key}`, { limit: 10, windowMs: 60_000 });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Server misconfigured — ADMIN_PASSWORD not set" },
      { status: 500 }
    );
  }

  let password: unknown;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!verifyPassword(password)) {
    recordFailedLogin(key);
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  clearFailedLogins(key);
  startSession();
  return NextResponse.json({ success: true });
}

/** Log out. */
export async function DELETE() {
  endSession();
  return NextResponse.json({ success: true });
}

/** Lets the dashboard restore a session after a page refresh. */
export async function GET() {
  return NextResponse.json({ authenticated: isAuthenticated() });
}
