import { NextResponse } from "next/server";
import { z } from "zod";
import { adminOrDenied, requireAdmin } from "@/lib/admin-guard";
import { dbConfigured } from "@/lib/db";
import { getAllPosts } from "@/lib/blog";
import { getPageById } from "@/lib/pages";
import { log, newRef } from "@/lib/log";
import { firstIssue } from "@/lib/validation";
import {
  createPreviewLink,
  listPreviewLinks,
  revokePreviewLink,
  linkState,
  PREVIEW_LINK_MAX_DAYS,
  PREVIEW_LINK_TTL_DAYS,
  type PreviewKind,
} from "@/lib/preview-links";

export const dynamic = "force-dynamic";

/**
 * Shareable preview links for one post or page.
 *
 * Any signed-in admin may make or revoke one: showing a draft to a reviewer is
 * part of writing it. The token is in the response to the POST that made it and
 * nowhere else — the database keeps a hash, so a link that was not copied when
 * it was made cannot be shown again, only revoked and replaced.
 */

const kindSchema = z.enum(["page", "post"]);
const idSchema = z.string().trim().min(1).max(64);

const createSchema = z.object({
  kind: kindSchema,
  id: idSchema,
  expiresInDays: z.number().int().min(1).max(PREVIEW_LINK_MAX_DAYS).optional(),
});

async function targetExists(kind: PreviewKind, id: string): Promise<boolean> {
  if (kind === "page") return Boolean(await getPageById(id));
  return (await getAllPosts()).some((p) => p.id === id);
}

function noDatabase() {
  log.error("previews.no_database");
  return NextResponse.json(
    { error: "Preview links need the database, which is not configured." },
    { status: 503 }
  );
}

/** The links made for one draft, with whether each still works. */
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!dbConfigured()) return noDatabase();

  const params = new URL(req.url).searchParams;
  const kind = kindSchema.safeParse(params.get("kind"));
  const id = idSchema.safeParse(params.get("id"));
  if (!kind.success || !id.success) {
    return NextResponse.json({ error: "Missing kind or id" }, { status: 400 });
  }

  const now = new Date();
  const links = await listPreviewLinks(kind.data, id.data);
  return NextResponse.json({
    links: links.map((link) => ({ ...link, state: linkState(link, now) })),
    // Sent rather than imported by the dashboard: the module that defines it
    // reaches the database and cannot be bundled into the browser.
    defaultDays: PREVIEW_LINK_TTL_DAYS,
  });
}

/** Makes a link. The response is the only place the full URL ever appears. */
export async function POST(req: Request) {
  const { identity, denied } = await adminOrDenied();
  if (denied) return denied;
  if (!dbConfigured()) return noDatabase();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { kind, id, expiresInDays } = parsed.data;
  if (!(await targetExists(kind, id))) {
    return NextResponse.json(
      { error: kind === "page" ? "That page no longer exists." : "That post no longer exists." },
      { status: 404 }
    );
  }

  const { link, path } = await createPreviewLink({
    kind,
    targetId: id,
    createdBy: identity.name,
    days: expiresInDays,
  });

  // The id is logged so a link can be traced to who made it; the token never is.
  log.info("previews.created", { ref: newRef(), linkId: link.id, kind });

  return NextResponse.json({
    link: { ...link, state: linkState(link) },
    path,
  });
}

/** Revokes a link. Answers 404 when there was no working link with that id. */
export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!dbConfigured()) return noDatabase();

  const id = idSchema.safeParse(new URL(req.url).searchParams.get("id"));
  if (!id.success) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const revoked = await revokePreviewLink(id.data);
  if (!revoked) {
    return NextResponse.json(
      { error: "That link is already off, or does not exist." },
      { status: 404 }
    );
  }
  log.info("previews.revoked", { ref: newRef(), linkId: id.data });
  return NextResponse.json({ success: true });
}
