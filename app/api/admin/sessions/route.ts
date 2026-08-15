import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { dbConfigured } from "@/lib/db";
import {
  createSession,
  listSessions,
  clientSessions,
  updateSession,
  deleteSession,
  SESSION_STATUSES,
  SessionClash,
} from "@/lib/practice";
import { log, errorFields } from "@/lib/log";
import {
  sendBookingConfirmation,
  sendCancellationNotice,
} from "@/lib/session-emails";

/** Everything upcoming, or one client's history when an id is given. */
export async function GET(req: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  if (!dbConfigured()) {
    return NextResponse.json({ configured: false, sessions: [] });
  }

  const clientId = new URL(req.url).searchParams.get("clientId");

  try {
    const sessions = clientId
      ? await clientSessions(clientId)
      : await listSessions();
    return NextResponse.json({ configured: true, sessions });
  } catch (error) {
    log.error("sessions.list_failed", errorFields(error));
    return NextResponse.json(
      { error: "Could not read sessions." },
      { status: 500 }
    );
  }
}

const createSchema = z.object({
  clientId: z.string().min(1),
  // Sent by the dashboard, which already has them on screen — cheaper than a
  // second query, and the booking is refused below if they are missing.
  clientName: z.string().min(1).max(120),
  clientEmail: z.string().email(),
  startsAt: z.string().min(1),
  minutes: z.number().int().min(5).max(480).optional(),
  rateAmount: z.number().int().min(0).max(1_000_000).nullable().optional(),
  note: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const session = await createSession(parsed.data);
    log.info("session.created", { id: session.id, clientId: parsed.data.clientId });

    /*
      Telling the client is part of booking, not a nicety — before this, a
      booking was silent and they heard nothing until the reminder the day
      before. It is not fatal, though: the session exists and is on the
      dashboard, so a mail provider having a bad minute must not undo it. The
      response says whether the email went, so the screen can be honest.
    */
    const notified = await sendBookingConfirmation({
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail,
      startsAt: session.starts_at,
    }).catch(() => ({ sent: false }));

    if (!notified.sent) {
      log.error("session.confirmation_failed", { id: session.id });
    }

    return NextResponse.json({ session, notified: notified.sent });
  } catch (error) {
    // A clash is a normal thing to run into, not a fault — say what it clashes
    // with so the answer is obvious.
    if (error instanceof SessionClash) {
      // The instant is returned rather than a formatted string: the server has
      // no business deciding which timezone to render in, and a message that
      // disagrees with the times listed beside it is worse than no message.
      return NextResponse.json(
        {
          error: "That overlaps an existing session.",
          clash: { clientName: error.clientName, startsAt: error.startsAt },
        },
        { status: 409 }
      );
    }

    log.error("session.create_failed", errorFields(error));
    return NextResponse.json(
      {
        error:
          error instanceof Error && /valid date/.test(error.message)
            ? error.message
            : "Could not book that session.",
      },
      { status: 400 }
    );
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  clientName: z.string().max(120).optional(),
  clientEmail: z.string().email().optional(),
  status: z.enum(SESSION_STATUSES).optional(),
  paid: z.boolean().optional(),
  rate_amount: z.number().int().min(0).max(1_000_000).nullable().optional(),
  note: z.string().max(2000).optional(),
});

export async function PATCH(req: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;

  try {
    const session = await updateSession(id, fields);
    if (!session) {
      return NextResponse.json({ error: "No such session" }, { status: 404 });
    }

    // A cancellation is the one status change the client needs to hear about.
    // Completed, no-show and paid are the practitioner's own bookkeeping.
    let notified: boolean | undefined;
    if (fields.status === "cancelled" && parsed.data.clientEmail) {
      const result = await sendCancellationNotice({
        clientName: parsed.data.clientName ?? "there",
        clientEmail: parsed.data.clientEmail,
        startsAt: session.starts_at,
      }).catch(() => ({ sent: false }));
      notified = result.sent;
      if (!result.sent) log.error("session.cancellation_email_failed", { id });
    }

    return NextResponse.json({ session, notified });
  } catch (error) {
    log.error("session.update_failed", { id, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not save that change." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const removed = await deleteSession(id);
    if (!removed) {
      return NextResponse.json({ error: "No such session" }, { status: 404 });
    }
    log.info("session.deleted", { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("session.delete_failed", { id, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not remove that session." },
      { status: 500 }
    );
  }
}
