import { NextResponse } from "next/server";
import { getSubmissions, deleteSubmission } from "@/lib/content";
import { requireAdmin } from "@/lib/admin-guard";
import { log, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = requireAdmin();
  if (denied) return denied;

  return NextResponse.json(await getSubmissions());
}

/** Removes one submission permanently. There is no undo — the record is gone. */
export async function DELETE(req: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const removed = await deleteSubmission(id);
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
