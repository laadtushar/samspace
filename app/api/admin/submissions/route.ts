import { NextResponse } from "next/server";
import { getSubmissions } from "@/lib/content";

export async function GET(req: Request) {
  const pw = req.headers.get("x-admin-password");
  if (pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const submissions = await getSubmissions();
  return NextResponse.json(submissions);
}
