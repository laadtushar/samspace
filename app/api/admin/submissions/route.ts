import { NextResponse } from "next/server";
import { getSubmissions } from "@/lib/content";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = requireAdmin();
  if (denied) return denied;

  return NextResponse.json(await getSubmissions());
}
