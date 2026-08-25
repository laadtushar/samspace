import { NextResponse } from "next/server";
import { z } from "zod";
import { ownerOrDenied } from "@/lib/admin-guard";
import { getContent, saveContent } from "@/lib/content";
import { getAllPosts, savePost } from "@/lib/blog";
import { reprice, RATE_PATTERN, type Rewrite } from "@/lib/reprice";
import { siteContentSchema, firstIssue } from "@/lib/validation";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Changes a published rate everywhere it appears.
 *
 * The sliding scale, the services card, the FAQ answer and the body of every
 * post are served from stored content, so a rate change in the codebase does
 * not reach any of them. This applies the same change to all of them in one
 * pass, so the site cannot end up quoting two different prices.
 *
 * `dryRun` reports exactly what would change and writes nothing. Use it first —
 * this rewrites published copy, and the preview is the review step.
 *
 * Owner-only, and both amounts must be plain rupee figures. It is a rate
 * correction, not a general find-and-replace over the whole site.
 */

const bodySchema = z.object({
  from: z.string().trim().regex(RATE_PATTERN, "From must be a rupee amount, e.g. ₹500"),
  to: z.string().trim().regex(RATE_PATTERN, "To must be a rupee amount, e.g. ₹600"),
  dryRun: z.boolean().optional().default(false),
});

interface Target {
  /** "Site content", or a post's slug. */
  label: string;
  changes: Rewrite[];
  saved: boolean;
}

export async function POST(request: Request) {
  const ref = newRef();
  const { denied } = await ownerOrDenied();
  if (denied) return denied;

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { from, to, dryRun } = parsed.data;
  if (from === to) {
    return NextResponse.json(
      { error: "The two amounts are the same — nothing to change." },
      { status: 400 }
    );
  }

  const targets: Target[] = [];
  const failed: string[] = [];

  // ─── Site content ───
  try {
    const current = await getContent();
    const { value, changes } = reprice(current, from, to);
    if (changes.length > 0) {
      // Back through the same schema the dashboard writes with, so a rewrite
      // can never store a shape the site would then fail to render.
      const validated = siteContentSchema.safeParse(value);
      if (!validated.success) {
        failed.push("content");
        log.error("reprice.content_invalid", { ref, reason: firstIssue(validated.error) });
      } else {
        if (!dryRun) await saveContent(validated.data);
        targets.push({ label: "Site content", changes, saved: !dryRun });
      }
    }
  } catch (error) {
    failed.push("content");
    log.error("reprice.content_failed", { ref, ...errorFields(error) });
  }

  // ─── Posts ───
  let posts: Awaited<ReturnType<typeof getAllPosts>> = [];
  try {
    posts = await getAllPosts();
  } catch (error) {
    failed.push("posts");
    log.error("reprice.posts_unreadable", { ref, ...errorFields(error) });
  }

  for (const post of posts) {
    // The stored slug is the identity, so it is rewritten from neither side —
    // a changed slug would move the post's URL and break every link to it.
    const editable = {
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      coverAlt: post.coverAlt,
    };
    const { value, changes } = reprice(editable, from, to);
    if (changes.length === 0) continue;

    try {
      if (!dryRun) {
        await savePost({
          ...post,
          ...value,
          tags: post.tags,
          coverImage: post.coverImage,
          status: post.status,
          publishedAt: post.publishedAt,
        });
      }
      targets.push({ label: post.slug, changes, saved: !dryRun });
    } catch (error) {
      // One post that will not save must not stop the rest from being fixed.
      failed.push(post.slug);
      log.error("reprice.post_failed", { ref, slug: post.slug, ...errorFields(error) });
    }
  }

  const edits = targets.reduce((n, t) => n + t.changes.length, 0);
  log.info("reprice.done", {
    ref,
    from,
    to,
    dryRun,
    targets: targets.length,
    edits,
    failed: failed.length,
  });

  return NextResponse.json({
    from,
    to,
    dryRun,
    targets,
    edits,
    failed,
    ...(failed.length > 0 ? { ref } : {}),
  });
}
