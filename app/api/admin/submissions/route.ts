import { NextResponse } from "next/server";
import { getSubmissions, deleteSubmission } from "@/lib/content";
import { dbConfigured } from "@/lib/db";
import {
  listSubmissionsForDashboard,
  deleteSubmissionRow,
  type DashboardSubmission,
} from "@/lib/practice";
import { mergeSubmissions, withTimeout } from "@/lib/submissions-view";
import { requireAdmin } from "@/lib/admin-guard";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Everything that was stored, from both places it can be stored.
 *
 * A submission is written to blob storage and then to the database, and that
 * second write is deliberately allowed to fail so an unreachable database
 * cannot cost someone their enquiry. Reading only the database threw that away:
 * the record survived the failure and then never reached the screen, so nobody
 * answered it.
 *
 * Both are read, and neither failing empties the page. When one cannot be read
 * the response says so, because a short list that looks complete is the
 * problem, not the missing rows themselves.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const ref = newRef();

  /*
    Each store is read with a deadline, and failing or timing out both resolve
    to null. A store that hangs would otherwise hold the whole request until the
    platform kills it, which is a worse outcome than a short list clearly
    labelled as short.
  */
  const [database, archive] = await Promise.all([
    // Not configured is not a failure — there is simply nothing to read there.
    dbConfigured()
      ? withTimeout(
          listSubmissionsForDashboard().catch((error) => {
            log.error("submissions.database_unreadable", { ref, ...errorFields(error) });
            throw error;
          })
        )
      : Promise.resolve<DashboardSubmission[]>([]),
    withTimeout(
      getSubmissions().catch((error) => {
        log.error("submissions.archive_unreadable", { ref, ...errorFields(error) });
        throw error;
      })
    ),
  ]);

  // Both gone means we know nothing, and an empty list would be a lie.
  if (database === null && archive === null) {
    return NextResponse.json(
      { error: "Could not read the submissions just now.", ref },
      { status: 503 }
    );
  }

  const view = mergeSubmissions(database, archive);

  if (view.unavailable.length > 0) {
    log.warn("submissions.partial", {
      ref,
      unavailable: view.unavailable.join(","),
      shown: view.submissions.length,
    });
    return NextResponse.json({ ...view, ref });
  }

  return NextResponse.json(view);
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
