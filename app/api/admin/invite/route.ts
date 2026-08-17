import { NextResponse } from "next/server";
import { adminForInviteToken, acceptInvite } from "@/lib/admin-users";
import { passwordProblem, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Accepting an invitation.
 *
 * The only unauthenticated route under /api/admin, and deliberately so: the
 * person using it has no account yet. The token is the whole credential, which
 * is why it is 32 random bytes, single-use, stored only as a digest, and
 * expires in two days.
 */

const EXPIRED = "That invitation link is no longer valid. Ask for a new one.";

/** Tells the setup page whose invitation this is, without requiring a session. */
export async function GET(req: Request) {
  const key = clientKey(req);
  const limited = rateLimit(`invite-check:${key}`, { limit: 20, windowMs: 60_000 });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const token = new URL(req.url).searchParams.get("token") ?? "";
  try {
    const user = await adminForInviteToken(token);
    if (!user) return NextResponse.json({ valid: false, error: EXPIRED }, { status: 404 });
    return NextResponse.json({
      valid: true,
      name: user.name,
      email: user.email,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    });
  } catch (error) {
    const ref = newRef();
    log.error("admin.invite.check_failed", { ref, ...errorFields(error) });
    return NextResponse.json({ valid: false, error: "Could not check that link.", ref }, { status: 500 });
  }
}

/** Sets the password the invitation was issued for. */
export async function POST(req: Request) {
  const ref = newRef();
  const key = clientKey(req);
  const limited = rateLimit(`invite-accept:${key}`, { limit: 10, windowMs: 60_000 });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  let body: { token?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof body.token !== "string" || !body.token) {
    return NextResponse.json({ error: EXPIRED }, { status: 400 });
  }
  const problem = passwordProblem(body.password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const user = await acceptInvite(body.token, body.password as string);
    if (!user) return NextResponse.json({ error: EXPIRED }, { status: 404 });

    log.info("admin.invite.accepted", { ref, userId: user.id, role: user.role });
    // Deliberately no session: the next thing they do is sign in properly,
    // which proves the password works and exercises the emailed code once.
    return NextResponse.json({ success: true, email: user.email });
  } catch (error) {
    log.error("admin.invite.accept_failed", { ref, ...errorFields(error) });
    return NextResponse.json({ error: "Could not set up that account.", ref }, { status: 500 });
  }
}
