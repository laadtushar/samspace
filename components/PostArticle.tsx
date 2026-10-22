import Link from "next/link";
import Image from "next/image";
import { readingMinutes, type BlogPost } from "@/lib/blog-format";
import { AUTHOR } from "@/lib/author";
import Markdown from "@/components/Markdown";

/**
 * A post as a reader sees it: byline, heading, cover, body, tags and the
 * booking prompt.
 *
 * Its own component so the live post page and the draft preview render one
 * piece of markup. A preview that is a near-copy of the real page is a preview
 * of the copy, and the two drift the first time only one of them is edited.
 *
 * Expects a post whose tokens are already filled (publicPost).
 */

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PostArticle({ post }: { post: BlogPost }) {
  return (
    <article className="max-w-2xl mx-auto px-6 pt-32 pb-24">
      <nav aria-label="Breadcrumb" className="mb-8">
        <Link
          href="/blog"
          className="font-sans text-xs text-forest/45 hover:text-clay transition-colors"
        >
          ← All writing
        </Link>
      </nav>

      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
          {/* A visible byline: for health writing Google looks for who wrote
              it, not only for the name in the structured data. */}
          <span className="font-sans text-xs text-forest/60">
            By{" "}
            <Link
              href={AUTHOR.path}
              rel="author"
              className="text-forest underline underline-offset-2 decoration-forest/30 hover:text-clay transition-colors"
            >
              {AUTHOR.name}
            </Link>
            , {AUTHOR.jobTitle}
          </span>
          {post.publishedAt && (
            <time
              dateTime={post.publishedAt}
              className="font-sans text-xs text-forest/45"
            >
              {formatDate(post.publishedAt)}
            </time>
          )}
          <span className="font-sans text-xs text-forest/30">
            {readingMinutes(post.content)} min read
          </span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-forest leading-tight mb-4">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="font-sans text-base text-forest/60 leading-relaxed">
            {post.excerpt}
          </p>
        )}
      </header>

      {post.coverImage &&
        /*
          Vector covers bypass the image optimiser: it refuses SVG unless
          dangerouslyAllowSVG is on, which would then apply to anything
          pasted into the dashboard later too. These are a few kilobytes and
          resolution-independent, so there is nothing to optimise — and a
          plain tag is what lets the animation inside them run.
        */
        (post.coverImage.toLowerCase().endsWith(".svg") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt={post.coverAlt || ""}
            width={1200}
            height={675}
            className="rounded-2xl w-full h-auto mb-10"
          />
        ) : (
          <Image
            src={post.coverImage}
            alt={post.coverAlt || ""}
            width={1200}
            height={675}
            priority
            sizes="(max-width: 672px) 100vw, 672px"
            className="rounded-2xl w-full h-auto mb-10"
          />
        ))}

      <Markdown>{post.content}</Markdown>

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-sage/20">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="font-sans text-[11px] text-forest/50 bg-forest/5 rounded-full px-3 py-1"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <aside className="bg-forest rounded-2xl p-8 mt-14 text-center">
        <p className="font-serif text-xl text-cream mb-3">
          If any of this sounded like you
        </p>
        <p className="font-sans text-sm text-cream/60 leading-relaxed mb-6">
          Reading about it is a start. Talking it through is the next bit.
          Sessions run on a sliding scale, online.
        </p>
        <Link
          href="/?intake=true"
          className="inline-block font-sans text-sm font-medium bg-clay text-cream px-6 py-3 rounded-full hover:bg-clay-light transition-colors"
        >
          Book a session
        </Link>
      </aside>
    </article>
  );
}
