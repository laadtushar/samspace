import { fillDeep, rateValues } from "@/lib/tokens";
import type { BlogPost } from "@/lib/blog-format";

/**
 * Posts on their way to a reader, with pricing tokens filled in.
 *
 * A post can say {{rate.range}} for the same reason site copy can: the rate
 * belongs in the rates list, not typed into seven articles. But the token only
 * works where something resolves it, and it was being resolved at three of the
 * five places posts are served — the archive and the post page — while the feed,
 * the homepage links and /start passed stored text straight through. A reader
 * subscribing by RSS would have been sent the literal braces.
 *
 * So resolution lives here, and every consumer calls the same function rather
 * than remembering to. Tokens resolve on the public boundary only: the dashboard
 * must keep seeing {{rate.range}}, or saving a post would bake today's number in
 * and quietly undo the arrangement.
 */
export function publicPosts<T extends Pick<BlogPost, "title">>(
  posts: readonly T[],
  slidingScale: readonly string[]
): T[] {
  return fillDeep([...posts], rateValues(slidingScale));
}

/** The same resolution for a single post. */
export function publicPost<T extends Pick<BlogPost, "title">>(
  post: T,
  slidingScale: readonly string[]
): T {
  return fillDeep(post, rateValues(slidingScale));
}
