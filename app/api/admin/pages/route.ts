import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { dbConfigured } from "@/lib/db";
import { log } from "@/lib/log";
import { firstIssue } from "@/lib/validation";
import { pageSchema } from "@/lib/page-format";
import { getAllPages, getPageBySlug, savePage, deletePage } from "@/lib/pages";

export const dynamic = "force-dynamic";

/** All pages, drafts included. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  // As with posts: "no pages yet" and "pages cannot be read" must not look the
  // same here, or a new page gets written over ones nobody can currently see.
  if (!dbConfigured()) {
    log.error("pages.no_database");
    return NextResponse.json(
      { error: "Page storage is not configured." },
      { status: 503 }
    );
  }

  return NextResponse.json(await getAllPages());
}

/** Creates or updates a page. `previousSlug` marks an edit that renames it. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // The slug rules — format and the reserved list — are part of the schema, so
  // a request made without the dashboard is held to them too.
  const parsed = pageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const previousSlug =
    typeof body.previousSlug === "string" ? body.previousSlug : undefined;

  if (parsed.data.slug !== previousSlug) {
    const clash = await getPageBySlug(parsed.data.slug);
    if (clash) {
      return NextResponse.json(
        { error: `A page already uses the URL "/${parsed.data.slug}"` },
        { status: 409 }
      );
    }
  }

  const page = await savePage({ ...parsed.data, previousSlug });

  // /<slug> is statically cached; publishing or unpublishing has to show at
  // once, and a rename has to stop serving the old address.
  revalidatePath(`/${page.slug}`);
  if (previousSlug && previousSlug !== page.slug) {
    revalidatePath(`/${previousSlug}`);
  }
  return NextResponse.json({ success: true, page });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  await deletePage(slug);
  revalidatePath(`/${slug}`);

  return NextResponse.json({ success: true });
}
