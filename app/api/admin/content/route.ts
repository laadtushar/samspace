import { NextResponse } from "next/server";
import { getContent, saveContent } from "@/lib/content";

export async function GET(req: Request) {
  const pw = req.headers.get("x-admin-password");
  if (pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const content = await getContent();
  return NextResponse.json(content);
}

export async function POST(req: Request) {
  const pw = req.headers.get("x-admin-password");
  if (pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const content = await req.json();
  await saveContent(content);
  return NextResponse.json({ success: true });
}
