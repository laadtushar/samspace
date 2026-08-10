import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";

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
    <div className="font-sans text-forest/80 leading-relaxed">
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
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-5 space-y-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-5 space-y-2">{children}</ol>
          ),
          li: ({ children }) => <li className="text-base">{children}</li>,
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
          pre: ({ children }) => (
            <pre className="bg-forest text-cream rounded-xl p-5 mb-6 overflow-x-auto text-sm">
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
          // next/image can only optimise hosts listed in next.config's
          // remotePatterns; an image pasted from anywhere else still has to
          // render, so it falls back to a plain tag.
          img: ({ src, alt }) => {
            if (typeof src !== "string") return null;
            const optimisable = src.includes(".public.blob.vercel-storage.com");
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
