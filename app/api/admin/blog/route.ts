import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { blogPostSchema, firstIssue } from "@/lib/validation";
import { getAllPosts, getPostBySlug, savePost, deletePost } from "@/lib/blog";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/** All posts, drafts included. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json(await getAllPosts());
}

/** Creates or updates a post. `previousSlug` marks an edit that renames it. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = blogPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const previousSlug =
    typeof body.previousSlug === "string" ? body.previousSlug : undefined;

  // Two different posts must never share a slug, or one silently overwrites the
  // other at save time.
  if (parsed.data.slug !== previousSlug) {
    const clash = await getPostBySlug(parsed.data.slug);
    if (clash) {
      return NextResponse.json(
        { error: `A post already uses the URL "${parsed.data.slug}"` },
        { status: 409 }
      );
    }
  }

  const post = await savePost({ ...parsed.data, previousSlug });

  // The public pages are statically cached; without this an author would
  // publish and see nothing change until the revalidation window elapsed.
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  if (previousSlug && previousSlug !== post.slug) {
    revalidatePath(`/blog/${previousSlug}`);
  }

  return NextResponse.json({ success: true, post });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  await deletePost(slug);
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);

  return NextResponse.json({ success: true });
}
