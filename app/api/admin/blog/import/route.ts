import { NextResponse } from "next/server";
import { ownerOrDenied } from "@/lib/admin-guard";
import { STARTER_POSTS } from "@/lib/starter-posts";
import { getPostBySlug, savePost } from "@/lib/blog";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Copies the posts that ship with the site into the blog.
 *
 * Once imported they are ordinary posts, edited in the dashboard like any
 * other. A slug that already exists is skipped rather than overwritten, which
 * is what makes this safe to press twice: the button can never quietly discard
 * an edit made after the first import.
 *
 * Owner-only. It writes published content to a public site, which is not
 * something every account with dashboard access should be able to do.
 */
export async function POST() {
  const ref = newRef();
  const { denied } = await ownerOrDenied();
  if (denied) return denied;

  const imported: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const starter of STARTER_POSTS) {
    try {
      if (await getPostBySlug(starter.slug)) {
        skipped.push(starter.slug);
        continue;
      }

      await savePost({
        slug: starter.slug,
        title: starter.title,
        excerpt: starter.excerpt,
        content: starter.content,
        coverImage: starter.coverImage,
        coverAlt: starter.coverAlt,
        tags: starter.tags,
        // Imported as drafts on purpose. Publishing four posts at once from a
        // button press, with nobody having looked at them on the live site
        // first, is not a decision a button should be making.
        status: "draft",
        seoTitle: starter.seoTitle,
        seoDescription: starter.seoDescription,
        publishedAt: "",
      });
      imported.push(starter.slug);
    } catch (error) {
      // One bad post must not stop the rest from arriving.
      failed.push(starter.slug);
      log.error("blog.import_failed", {
        ref,
        slug: starter.slug,
        ...errorFields(error),
      });
    }
  }

  log.info("blog.imported", {
    ref,
    imported: imported.length,
    skipped: skipped.length,
    failed: failed.length,
  });

  return NextResponse.json({
    imported,
    skipped,
    failed,
    available: STARTER_POSTS.length,
    ...(failed.length > 0 ? { ref } : {}),
  });
}

/** What is available to import, and what is already here. */
export async function GET() {
  const { denied } = await ownerOrDenied();
  if (denied) return denied;

  const present = await Promise.all(
    STARTER_POSTS.map(async (starter) => ({
      slug: starter.slug,
      title: starter.title,
      alreadyPresent: Boolean(await getPostBySlug(starter.slug)),
    }))
  );

  return NextResponse.json({
    posts: present,
    remaining: present.filter((p) => !p.alreadyPresent).length,
  });
}
