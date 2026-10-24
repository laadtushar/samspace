import Markdown from "@/components/Markdown";
import type { Page } from "@/lib/page-format";

/**
 * A standalone page as a reader sees it: its heading, then its body.
 *
 * The same column, type and markdown renderer as a post, so a landing page
 * reads as part of the site rather than a template bolted onto it. No byline,
 * date or tags: a page is not dated writing.
 *
 * Shared by /<slug> and the previews, for the same reason PostArticle is.
 * Expects a page whose tokens are already filled (publicPage).
 */
export default function PageArticle({ page }: { page: Pick<Page, "title" | "content"> }) {
  return (
    <article className="max-w-2xl mx-auto px-6 pt-32 pb-24">
      <header className="mb-10">
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-forest leading-tight">
          {page.title}
        </h1>
      </header>
      <Markdown>{page.content}</Markdown>
    </article>
  );
}
