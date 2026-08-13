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
} from "@/lib/practice";
import { log, errorFields } from "@/lib/log";

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
    return NextResponse.json({ session });
  } catch (error) {
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
    return NextResponse.json({ session });
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
