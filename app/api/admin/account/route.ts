import { NextResponse } from "next/server";
import { z } from "zod";
import { adminOrDenied } from "@/lib/admin-guard";
import { changePassword, listSessionsFor, revokeAllSessions } from "@/lib/admin-users";
import { passwordProblem, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH),
});

/** Who you are, and where else you are still signed in. */
export async function GET() {
  const { identity, denied } = await adminOrDenied();
  if (denied) return denied;

  const sessions = identity.userId ? await listSessionsFor(identity.userId) : [];
  return NextResponse.json({
    user: {
      name: identity.name,
      email: identity.email,
      role: identity.role,
      legacy: identity.legacy,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      created_at: s.created_at,
      last_seen_at: s.last_seen_at,
      user_agent: s.user_agent,
      current: s.id === identity.sessionId,
    })),
  });
}

/**
 * Changes your own password.
 *
 * The current password is required even though you are already signed in: an
 * unattended open laptop should not be enough to take an account over.
 */
export async function POST(req: Request) {
  const ref = newRef();
  const { identity, denied } = await adminOrDenied();
  if (denied) return denied;

  if (!identity.userId) {
    return NextResponse.json(
      {
        error:
          "This is the shared setup password, which lives in the site's settings rather than in an account. Create your own account first.",
      },
      { status: 400 }
    );
  }

  let parsed;
  try {
    parsed = passwordSchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  }

  const problem = passwordProblem(parsed.data.newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (parsed.data.newPassword === parsed.data.currentPassword) {
    return NextResponse.json({ error: "That is the password you already have." }, { status: 400 });
  }

  try {
    const ok = await changePassword({
      userId: identity.userId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      keepSessionId: identity.sessionId ?? undefined,
    });
    if (!ok) {
      log.warn("admin.password.rejected", { ref, userId: identity.userId });
      return NextResponse.json({ error: "That is not your current password." }, { status: 401 });
    }
    log.info("admin.password.changed", { ref, userId: identity.userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("admin.password.failed", { ref, ...errorFields(error) });
    return NextResponse.json({ error: "Could not change your password.", ref }, { status: 500 });
  }
}

/** Signs out every other browser, leaving this one signed in. */
export async function DELETE() {
  const ref = newRef();
  const { identity, denied } = await adminOrDenied();
  if (denied) return denied;
  if (!identity.userId) {
    return NextResponse.json({ error: "Not available for the setup password." }, { status: 400 });
  }

  try {
    const ended = await revokeAllSessions(identity.userId, identity.sessionId ?? undefined);
    log.info("admin.sessions.revoked", { ref, userId: identity.userId, ended });
    return NextResponse.json({ success: true, ended });
  } catch (error) {
    log.error("admin.sessions.revoke_failed", { ref, ...errorFields(error) });
    return NextResponse.json({ error: "Could not sign the other sessions out.", ref }, { status: 500 });
  }
}
