import { NextResponse } from "next/server";
import { defaultContent, getContent, saveContent } from "@/lib/content";
import { log, errorFields } from "@/lib/log";
import { requireAdmin } from "@/lib/admin-guard";
import { siteContentSchema, firstIssue } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Says whether the body is what is actually stored.
 *
 * The dashboard has to know the difference. Saving replaces the stored copy
 * wholesale, so handing it the shipped defaults without a word would let one
 * click overwrite everything that was written — and look like an ordinary save
 * while doing it.
 */
const STORED_HEADER = "X-Content-Stored";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json(await getContent(), {
      headers: { [STORED_HEADER]: "true" },
    });
  } catch (error) {
    /*
      Refusing to open was the safe half of the answer and only the safe half.
      When the blob store passed its limit and began answering 403, this route
      was the one 500 on the dashboard, and the practitioner could not reach the
      blog, the clients or the sessions either — every tab sits behind this one
      load. A tool that locks its owner out during an outage is not protecting
      them.

      So it opens, on the shipped copy, and says plainly that this is not what
      is stored. The protection stays where it belongs: on the save, which is
      now a decision someone makes rather than an accident they walk into.
    */
    log.error("admin.content_unreadable", errorFields(error));
    return NextResponse.json(defaultContent, {
      headers: { [STORED_HEADER]: "false" },
    });
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
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
