import { NextResponse } from "next/server";
import { migrateLegacySubmissions } from "@/lib/content";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/**
 * Moves submissions out of the original single public blob and into
 * per-submission private ones, then deletes the public copy.
 */
export async function POST() {
  const denied = requireAdmin();
  if (denied) return denied;

  try {
    const { migrated } = await migrateLegacySubmissions();
    return NextResponse.json({
      success: true,
      migrated,
      message:
        migrated > 0
          ? `Moved ${migrated} submission(s) to private storage and removed the public copy.`
          : "Nothing left to migrate — all submissions are already in private storage.",
    });
  } catch (error) {
    console.error("[admin/migrate] failed", error);
    return NextResponse.json(
      { error: "Migration failed. Check the server logs." },
      { status: 500 }
    );
  }
}
