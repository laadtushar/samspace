import { NextResponse } from "next/server";
import { ownerOrDenied } from "@/lib/admin-guard";
import { STARTER_PAGES } from "@/lib/starter-pages";
import { getPageBySlug, savePage } from "@/lib/pages";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Copies the pages that ship with the site into the Pages tab.
 *
 * The blog's import, for pages (app/api/admin/blog/import): a slug that already
 * exists is skipped rather than overwritten, so pressing it twice cannot
 * discard an edit, and everything arrives as a draft. Nothing is written to the
 * database by deploying this code — only by an owner pressing the button.
 */
export async function POST() {
  const ref = newRef();
  const { denied } = await ownerOrDenied();
  if (denied) return denied;

  const imported: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const starter of STARTER_PAGES) {
    try {
      if (await getPageBySlug(starter.slug)) {
        skipped.push(starter.slug);
        continue;
      }

      await savePage({
        slug: starter.slug,
        title: starter.title,
        content: starter.content,
        // Always a draft. Several facts in a starter page are placeholders in
        // square brackets until the practitioner confirms them; publishing from
        // a button would put those brackets in front of clients.
        status: "draft",
        seoTitle: starter.seoTitle,
        seoDescription: starter.seoDescription,
      });
      imported.push(starter.slug);
    } catch (error) {
      failed.push(starter.slug);
      log.error("pages.import_failed", {
        ref,
        slug: starter.slug,
        ...errorFields(error),
      });
    }
  }

  log.info("pages.imported", {
    ref,
    imported: imported.length,
    skipped: skipped.length,
    failed: failed.length,
  });

  return NextResponse.json({
    imported,
    skipped,
    failed,
    available: STARTER_PAGES.length,
    ...(failed.length > 0 ? { ref } : {}),
  });
}

/** What is available to import, and what is already here. */
export async function GET() {
  const { denied } = await ownerOrDenied();
  if (denied) return denied;

  const present = await Promise.all(
    STARTER_PAGES.map(async (starter) => ({
      slug: starter.slug,
      title: starter.title,
      alreadyPresent: Boolean(await getPageBySlug(starter.slug)),
    }))
  );

  return NextResponse.json({
    pages: present,
    remaining: present.filter((p) => !p.alreadyPresent).length,
  });
}
