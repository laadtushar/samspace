import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json();
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Server misconfigured — ADMIN_PASSWORD not set" },
      { status: 500 }
    );
  }
  if (password === expected) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Invalid password" }, { status: 401 });
}
