import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { dbConfigured } from "@/lib/db";
import {
  listClients,
  clientSubmissions,
  updateClient,
  CLIENT_STATUSES,
} from "@/lib/practice";
import { log, errorFields } from "@/lib/log";

/**
 * Lists everyone the practice knows, or one person's submission history when
 * an id is given.
 */
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!dbConfigured()) {
    // Not an error: the dashboard shows an explanation rather than a failure.
    return NextResponse.json({ configured: false, clients: [] });
  }

  const id = new URL(req.url).searchParams.get("id");

  try {
    if (id) {
      return NextResponse.json({
        configured: true,
        submissions: await clientSubmissions(id),
      });
    }
    return NextResponse.json({ configured: true, clients: await listClients() });
  } catch (error) {
    log.error("clients.list_failed", errorFields(error));
    return NextResponse.json(
      { error: "Could not read the client list." },
      { status: 500 }
    );
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(CLIENT_STATUSES).optional(),
  // Empty string is meaningful — it clears the field — so these are not
  // trimmed away into undefined.
  agreed_rate: z.string().max(60).optional(),
  admin_note: z.string().max(4000).optional(),
});

/** Updates the fields the practitioner owns. */
export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;

  try {
    const client = await updateClient(id, fields);
    if (!client) {
      return NextResponse.json({ error: "No such client" }, { status: 404 });
    }
    log.info("client.updated", { id, fields: Object.keys(fields).join(",") });
    return NextResponse.json({ client });
  } catch (error) {
    log.error("client.update_failed", { id, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not save that change." },
      { status: 500 }
    );
  }
}
