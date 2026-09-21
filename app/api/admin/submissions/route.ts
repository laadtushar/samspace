import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import {
  listSubmissionsForDashboard,
  deleteSubmissionRow,
  type DashboardSubmission,
} from "@/lib/practice";
import { submissionsView, withTimeout } from "@/lib/submissions-view";
import { requireAdmin } from "@/lib/admin-guard";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Everything that was stored.
 *
 * One store now. Submissions used to be written to the blob archive first and
 * the database second, so this read both and merged them — otherwise a record
 * that survived one store's bad day never reached the screen and nobody
 * answered it. Blob is gone and the database holds every field, so there is one
 * list.
 *
 * What has not changed is the rule that mattered: a short list must never look
 * like a complete one. A read that fails is reported as a failure rather than
 * rendered as "no submissions yet".
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const ref = newRef();

  if (!dbConfigured()) {
    log.error("submissions.no_database", { ref });
    return NextResponse.json(
      { error: "Submission storage is not configured.", ref },
      { status: 503 }
    );
  }

  /*
    Read with a deadline: failing and timing out both resolve to null. A store
    that hangs would otherwise hold the whole request until the platform kills
    it, which is a worse outcome than a short list clearly labelled as short.
  */
  const database = await withTimeout(
    listSubmissionsForDashboard().catch((error: unknown) => {
      log.error("submissions.database_unreadable", { ref, ...errorFields(error) });
      throw error;
    }) as Promise<DashboardSubmission[]>
  );

  if (database === null) {
    return NextResponse.json(
      { error: "Could not read the submissions just now.", ref },
      { status: 503 }
    );
  }

  return NextResponse.json(submissionsView(database));
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
    const removed = dbConfigured() ? await deleteSubmissionRow(id) : false;
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
