import { NextResponse } from "next/server";
import { getContent, saveContent } from "@/lib/content";
import { requireAdmin } from "@/lib/admin-guard";
import { siteContentSchema, firstIssue } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = requireAdmin();
  if (denied) return denied;

  return NextResponse.json(await getContent());
}

export async function POST(req: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Whatever is saved here renders on the public site, so it is validated
  // rather than trusted — a bad shape would blank sections, and an unchecked
  // link would become a script URL in an anchor tag.
  const parsed = siteContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  await saveContent(parsed.data);
  return NextResponse.json({ success: true, content: parsed.data });
}
