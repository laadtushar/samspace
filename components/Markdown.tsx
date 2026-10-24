import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";
import { MEDIA_PREFIX } from "@/lib/media";

/**
 * Renders post markdown.
 *
 * Server component, so none of this reaches the browser bundle. Raw HTML in the
 * source is escaped rather than rendered — react-markdown does that by default
 * and `rehype-raw` is deliberately not installed, which keeps a pasted
 * `<script>` inert.
 *
 * Elements are mapped explicitly rather than through a typography plugin so
 * post styling uses the same tokens as the rest of the site.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    // break-words: a long address written as link text has no spaces to wrap
    // at, and on a phone it pushed the whole page wider than the screen.
    <div className="font-sans text-forest/80 leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-forest mt-12 mb-4">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif text-2xl font-semibold text-forest mt-12 mb-4">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif text-xl font-semibold text-forest mt-8 mb-3">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="text-base mb-5">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-clay underline underline-offset-2 hover:text-clay-light transition-colors"
              {...(href?.startsWith("http")
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {children}
            </a>
          ),
          /*
            A "- [ ]" checklist (remark-gfm marks it with these class names) is a
            list of things to try, not a form: no bullet as well as a box, and
            the box is drawn rather than a disabled checkbox, which a screen
            reader would announce as a control nobody can use.
          */
          ul: ({ className, children }) =>
            className?.includes("contains-task-list") ? (
              <ul className="list-none pl-0 mb-5 space-y-2">{children}</ul>
            ) : (
              <ul className="list-disc pl-5 mb-5 space-y-2">{children}</ul>
            ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-5 space-y-2">{children}</ol>
          ),
          li: ({ className, children }) =>
            className?.includes("task-list-item") ? (
              <li className="text-base relative pl-7">{children}</li>
            ) : (
              <li className="text-base">{children}</li>
            ),
          input: ({ type, checked }) =>
            type === "checkbox" ? (
              <span
                aria-hidden="true"
                className={`absolute left-0 top-[0.3em] w-4 h-4 rounded border-2 border-sage/60 ${
                  checked ? "bg-sage/60" : ""
                }`}
              />
            ) : null,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-clay/40 pl-5 my-8 font-serif text-lg text-forest/70 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-sage/25 my-10" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-forest">{children}</strong>
          ),
          code: ({ children }) => (
            <code className="font-mono text-[0.85em] bg-forest/5 text-forest px-1.5 py-0.5 rounded">
              {children}
            </code>
          ),
          /*
            A fenced block — in posts, mostly small text diagrams. Its lines are
            as wide as the author drew them, so on a phone the block scrolls
            sideways inside itself rather than pushing the page wider. Focusable,
            so that scroll can be reached from a keyboard too.

            The `code` inside it is the same element inline code uses, and would
            otherwise pick up inline code's tint and dark text on this dark
            background; the child selectors put it back to plain text.
          */
          pre: ({ children }) => (
            <pre
              tabIndex={0}
              className="bg-forest text-cream rounded-xl p-5 mb-6 max-w-full overflow-x-auto text-sm leading-snug [&>code]:bg-transparent [&>code]:text-cream [&>code]:p-0 [&>code]:rounded-none [&>code]:text-[1em]"
            >
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="text-left font-medium text-forest border-b-2 border-sage/25 py-2 pr-4">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-sage/15 py-2 pr-4 align-top">
              {children}
            </td>
          ),
          /*
            next/image can only optimise an image it is allowed to fetch. Ours
            live on this origin under /media, so those are optimised; an image
            pasted from anywhere else — including one still pointing at the old
            blob CDN — still has to render, and falls back to a plain tag.
          */
          img: ({ src, alt }) => {
            if (typeof src !== "string") return null;
            const optimisable = src.startsWith(MEDIA_PREFIX);
            return optimisable ? (
              <Image
                src={src}
                alt={alt ?? ""}
                width={1200}
                height={675}
                className="rounded-2xl my-8 w-full h-auto"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt ?? ""}
                loading="lazy"
                className="rounded-2xl my-8 w-full h-auto"
              />
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
