import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ownerOrDenied } from "@/lib/admin-guard";
import { STARTER_POSTS, type StarterPost } from "@/lib/starter-posts";
import { getPostBySlug, savePost, type BlogPost } from "@/lib/blog";
import { blogPostSchema, firstIssue, type BlogPostInput } from "@/lib/validation";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * The posts that ship with the site, and the blog they are copied into.
 *
 * POST with no body copies in the ones that are missing. Once imported they are
 * ordinary posts, edited in the dashboard like any other. A slug that already
 * exists is skipped rather than overwritten, which is what makes this safe to
 * press twice: the button can never quietly discard an edit made after the
 * first import.
 *
 * POST with { "replace": [slug, …] } is the one deliberate exception: when the
 * shipped text of a post is rewritten after it went live, the owner can choose
 * to bring that post's words up to date. Only the words — the address, status,
 * publish date and cover belong to the live post and stay exactly as they are.
 *
 * Owner-only. It writes content to a public site, which is not something every
 * account with dashboard access should be able to do.
 */

/** The fields a replace overwrites, and the only ones compared. */
const SHIPPED_FIELDS = [
  "title",
  "excerpt",
  "content",
  "tags",
  "seoTitle",
  "seoDescription",
] as const;

type ShippedState = "missing" | "identical" | "differs";

/** Whether the post in the blog still says what the shipped version says. */
function shippedState(starter: StarterPost, post: BlogPost | null): ShippedState {
  if (!post) return "missing";
  const same = SHIPPED_FIELDS.every((field) => {
    const shipped = starter[field];
    const stored = post[field];
    if (Array.isArray(shipped)) {
      return (
        Array.isArray(stored) &&
        stored.length === shipped.length &&
        shipped.every((tag, i) => tag === stored[i])
      );
    }
    // A save through the dashboard trims, and an import does not; whitespace at
    // the ends is not a difference anyone could see or would want reported.
    return typeof stored === "string" && stored.trim() === shipped.trim();
  });
  return same ? "identical" : "differs";
}

const STARTER_SLUGS = new Set(STARTER_POSTS.map((p) => p.slug));

/** A replace request. Bounded, and nothing else accepted alongside it. */
const replaceSchema = z
  .object({
    replace: z
      .array(z.string().trim().min(1).max(120))
      .min(1, "Name at least one post to update")
      .max(STARTER_POSTS.length),
  })
  .strict();

/** Generous for a list of slugs, and small enough that nobody can stream a novel at it. */
const MAX_BODY = 8_000;

export async function POST(req: Request) {
  const ref = newRef();
  const { denied } = await ownerOrDenied();
  if (denied) return denied;

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  // No body is the import, exactly as it has always been.
  if (raw.trim() === "") return importMissing(ref);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = replaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  return replaceWithShipped([...new Set(parsed.data.replace)], ref);
}

/** Copies in every shipped post that is not in the blog yet, as a draft. */
async function importMissing(ref: string) {
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

/**
 * Overwrites the words of posts already in the blog with the shipped version.
 *
 * Everything is checked before anything is written, so a request naming one
 * post that cannot be updated changes none of them — a half-applied update is
 * harder to reason about than a refusal.
 */
async function replaceWithShipped(slugs: string[], ref: string) {
  const notShipped = slugs.filter((slug) => !STARTER_SLUGS.has(slug));
  if (notShipped.length > 0) {
    log.warn("blog.replace_refused", { ref, reason: "not_shipped", count: notShipped.length });
    return NextResponse.json(
      { error: `Not a post that ships with the site: ${notShipped.join(", ")}` },
      { status: 400 }
    );
  }

  const planned: { slug: string; input: BlogPostInput }[] = [];
  const missing: string[] = [];

  for (const slug of slugs) {
    const starter = STARTER_POSTS.find((p) => p.slug === slug)!;
    const existing = await getPostBySlug(slug);
    if (!existing) {
      missing.push(slug);
      continue;
    }

    /*
      Through the same schema a save from the editor goes through, so whatever
      that refuses — a published post carrying [To confirm: …] placeholders, a
      field over its length — this refuses too. The post keeps its own identity,
      address, status, publish date and cover; only the words come from here.
    */
    const checked = blogPostSchema.safeParse({
      id: existing.id,
      slug: existing.slug,
      title: starter.title,
      excerpt: starter.excerpt,
      content: starter.content,
      tags: starter.tags,
      seoTitle: starter.seoTitle,
      seoDescription: starter.seoDescription,
      coverImage: existing.coverImage,
      coverAlt: existing.coverAlt,
      status: existing.status,
      publishedAt: existing.publishedAt,
    });
    if (!checked.success) {
      log.warn("blog.replace_refused", { ref, reason: "invalid", slug });
      return NextResponse.json(
        { error: `${starter.title}: ${firstIssue(checked.error)}` },
        { status: 400 }
      );
    }
    planned.push({
      slug,
      // The cover is kept as stored, not as re-validated: an update to the words
      // must not be the thing that quietly drops a post's artwork.
      input: { ...checked.data, coverImage: existing.coverImage, coverAlt: existing.coverAlt },
    });
  }

  if (missing.length > 0) {
    log.warn("blog.replace_refused", { ref, reason: "missing", count: missing.length });
    return NextResponse.json(
      { error: `Not in the blog yet, so there is nothing to update: ${missing.join(", ")}` },
      { status: 404 }
    );
  }

  const replaced: string[] = [];
  const failed: string[] = [];
  for (const { slug, input } of planned) {
    try {
      const post = await savePost(input);
      replaced.push(post.slug);
      // The public pages are statically cached, exactly as for a normal save.
      revalidatePath(`/blog/${post.slug}`);
    } catch (error) {
      failed.push(slug);
      log.error("blog.replace_failed", { ref, slug, ...errorFields(error) });
    }
  }
  if (replaced.length > 0) revalidatePath("/blog");

  log.info("blog.replaced", { ref, replaced: replaced.length, failed: failed.length });

  return NextResponse.json(
    { replaced, failed, ...(failed.length > 0 ? { ref } : {}) },
    { status: failed.length > 0 && replaced.length === 0 ? 500 : 200 }
  );
}

/**
 * What is available to import, what is already here, and which of those no
 * longer say what the shipped version says.
 */
export async function GET() {
  const { denied } = await ownerOrDenied();
  if (denied) return denied;

  const posts = await Promise.all(
    STARTER_POSTS.map(async (starter) => {
      const existing = await getPostBySlug(starter.slug);
      const state = shippedState(starter, existing);
      return {
        slug: starter.slug,
        title: starter.title,
        alreadyPresent: existing !== null,
        state,
        ...(existing ? { status: existing.status } : {}),
      };
    })
  );

  return NextResponse.json({
    posts,
    remaining: posts.filter((p) => p.state === "missing").length,
    differing: posts.filter((p) => p.state === "differs").length,
  });
}
