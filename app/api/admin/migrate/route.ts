import { NextResponse } from "next/server";
import { migrateLegacySubmissions, getSubmissions } from "@/lib/content";
import { requireAdmin } from "@/lib/admin-guard";
import { dbConfigured } from "@/lib/db";
import { recordSubmission } from "@/lib/practice";
import { log, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Brings stored submissions up to date, in the order they need doing.
 *
 * First, anything still in the original single public blob is moved into
 * per-submission storage and the public copy deleted. Then every submission is
 * copied into the database, because the database only started receiving them
 * when the dual-write shipped — everything older exists in blob storage alone,
 * and the dashboard cannot be pointed at the database until that is no longer
 * true.
 *
 * Both halves are safe to repeat: the first skips what it has already moved,
 * and the second attaches a submission to its client by email and ignores an id
 * it has already stored.
 */
export async function POST() {
  const denied = requireAdmin();
  if (denied) return denied;

  try {
    const { migrated } = await migrateLegacySubmissions();

    let backfilled = 0;
    let failed = 0;

    if (dbConfigured()) {
      for (const submission of await getSubmissions()) {
        try {
          await recordSubmission(submission);
          backfilled += 1;
        } catch (error) {
          // One unreadable record must not stop the rest being copied.
          failed += 1;
          log.error("backfill.record_failed", {
            id: submission.id,
            ...errorFields(error),
          });
        }
      }
    }

    log.info("backfill.finished", { migrated, backfilled, failed });

    const parts: string[] = [];
    if (migrated > 0) {
      parts.push(`moved ${migrated} out of public storage`);
    }
    if (dbConfigured()) {
      parts.push(`${backfilled} submission(s) now in the database`);
      if (failed > 0) parts.push(`${failed} could not be copied — see the logs`);
    } else {
      parts.push("no database connected, so nothing was copied there");
    }

    return NextResponse.json({
      success: true,
      migrated,
      backfilled,
      failed,
      message: parts.length
        ? parts.join(" · ")
        : "Nothing to do — everything is already up to date.",
    });
  } catch (error) {
    log.error("migrate.failed", errorFields(error));
    return NextResponse.json(
      { error: "Migration failed. Check the server logs." },
      { status: 500 }
    );
  }
}
