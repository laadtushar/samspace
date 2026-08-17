import { NextResponse } from "next/server";
import { z } from "zod";
import { ownerOrDenied } from "@/lib/admin-guard";
import {
  listAdminUsers,
  inviteAdmin,
  setAdminRole,
  setAdminDisabled,
  deleteAdmin,
  DuplicateAdmin,
  LastOwner,
} from "@/lib/admin-users";
import { sendAdminInvite } from "@/lib/admin-emails";
import { dbConfigured } from "@/lib/db";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("That is not an email address").max(200),
  role: z.enum(["owner", "member"]).default("member"),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["owner", "member"]).optional(),
  disabled: z.boolean().optional(),
});

const NO_DATABASE = "Administrator accounts need a database. Connect one first.";

/** Everyone who can sign in, for the Users tab. */
export async function GET() {
  const { denied } = await ownerOrDenied();
  if (denied) return denied;
  if (!dbConfigured()) return NextResponse.json({ ready: false, users: [], error: NO_DATABASE });

  try {
    return NextResponse.json({ ready: true, users: await listAdminUsers() });
  } catch (error) {
    const ref = newRef();
    log.error("admin.users.list_failed", { ref, ...errorFields(error) });
    return NextResponse.json({ ready: false, users: [], error: "Could not read the list.", ref }, { status: 500 });
  }
}

/**
 * Invites someone.
 *
 * The account exists immediately but cannot be signed in to until the invitation
 * is accepted, which is what stops a half-finished invitation from counting as
 * an administrator. If the email does not go out the invitation is useless, so
 * that is reported as a failure rather than a success with a footnote.
 */
export async function POST(req: Request) {
  const ref = newRef();
  const { identity, denied } = await ownerOrDenied();
  if (denied) return denied;
  if (!dbConfigured()) return NextResponse.json({ error: NO_DATABASE }, { status: 400 });

  let parsed;
  try {
    parsed = inviteSchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the details" },
      { status: 400 }
    );
  }

  try {
    const { user, token, expiresAt } = await inviteAdmin(parsed.data);
    const sent = await sendAdminInvite({
      to: user.email,
      name: user.name,
      invitedBy: identity.name,
      token,
      expiresAt,
    });

    if (!sent.sent) {
      log.error("admin.users.invite_unsent", { ref, userId: user.id });
      return NextResponse.json(
        {
          error:
            "The account was created but the invitation email did not send. Use Resend again once email is working.",
          ref,
          user,
        },
        { status: 502 }
      );
    }

    log.info("admin.users.invited", { ref, userId: user.id, role: user.role });
    return NextResponse.json({ user, invited: true });
  } catch (error) {
    if (error instanceof DuplicateAdmin) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    log.error("admin.users.invite_failed", { ref, ...errorFields(error) });
    return NextResponse.json({ error: "Could not send that invitation.", ref }, { status: 500 });
  }
}

/** Changes a role, or disables and re-enables an account. */
export async function PATCH(req: Request) {
  const ref = newRef();
  const { identity, denied } = await ownerOrDenied();
  if (denied) return denied;

  let parsed;
  try {
    parsed = updateSchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the details" }, { status: 400 });
  }

  const { id, role, disabled } = parsed.data;

  // Locking yourself out is never the intent, and it is not recoverable from
  // inside the dashboard.
  if (identity.userId === id && disabled === true) {
    return NextResponse.json({ error: "You cannot disable your own account." }, { status: 400 });
  }
  if (identity.userId === id && role === "member") {
    return NextResponse.json(
      { error: "You cannot remove your own owner access — ask another owner." },
      { status: 400 }
    );
  }

  try {
    let user = null;
    if (role !== undefined) user = await setAdminRole(id, role);
    if (disabled !== undefined) user = await setAdminDisabled(id, disabled);
    if (!user) return NextResponse.json({ error: "No such account" }, { status: 404 });

    log.info("admin.users.updated", { ref, userId: id, role: user.role, disabled: Boolean(user.disabled_at) });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof LastOwner) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    log.error("admin.users.update_failed", { ref, ...errorFields(error) });
    return NextResponse.json({ error: "Could not save that change.", ref }, { status: 500 });
  }
}

/** Removes an account outright, along with its sessions. */
export async function DELETE(req: Request) {
  const ref = newRef();
  const { identity, denied } = await ownerOrDenied();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (identity.userId === id) {
    return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
  }

  try {
    const removed = await deleteAdmin(id);
    if (!removed) return NextResponse.json({ error: "No such account" }, { status: 404 });
    log.info("admin.users.removed", { ref, userId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof LastOwner) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    log.error("admin.users.delete_failed", { ref, ...errorFields(error) });
    return NextResponse.json({ error: "Could not remove that account.", ref }, { status: 500 });
  }
}
