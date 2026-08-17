import { NextResponse } from "next/server";
import { defaultContent, saveContent } from "@/lib/content";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/** Overwrites the live site content with the built-in defaults. */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  await saveContent(defaultContent);
  return NextResponse.json({
    success: true,
    message: "Default content seeded to Blob",
  });
}
