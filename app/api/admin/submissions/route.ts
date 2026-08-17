import { NextResponse } from "next/server";
import { getSubmissions, deleteSubmission } from "@/lib/content";
import { dbConfigured } from "@/lib/db";
import {
  listSubmissionsForDashboard,
  deleteSubmissionRow,
} from "@/lib/practice";
import { requireAdmin } from "@/lib/admin-guard";
import { log, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  /*
    The database is the source once one is connected: it is where new
    submissions are written, and showing blob storage instead would mean the
    screen and the writes could drift apart. Blob storage remains the source
    when there is no database, so nothing disappears from view.
  */
  if (dbConfigured()) {
    return NextResponse.json(await listSubmissionsForDashboard());
  }
  return NextResponse.json(await getSubmissions());
}

/** Removes one submission permanently. There is no undo — the record is gone. */
export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    // Removed from both, so a delete cannot leave a copy behind in whichever
    // store the screen is not currently reading.
    const removedFromDb = dbConfigured() ? await deleteSubmissionRow(id) : false;
    const removedFromBlob = await deleteSubmission(id).catch(() => false);
    const removed = removedFromDb || removedFromBlob;
    if (!removed) {
      return NextResponse.json(
        { error: "No submission with that id" },
        { status: 404 }
      );
    }
    log.info("submission.deleted", { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("submission.delete_failed", { id, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not delete that submission." },
      { status: 500 }
    );
  }
}
