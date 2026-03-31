import { NextResponse } from "next/server";
import { defaultContent, saveContent } from "@/lib/content";

export async function POST(req: Request) {
  const pw = req.headers.get("x-admin-password");
  if (pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await saveContent(defaultContent);
  return NextResponse.json({ success: true, message: "Default content seeded to Blob" });
}
