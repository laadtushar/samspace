import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getContent } from "@/lib/content";
import { getPublishedPosts, readingMinutes } from "@/lib/blog";
import { SITE_URL, SITE_NAME, serializeJsonLd } from "@/lib/site";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Writing on therapy, anxiety & student life",
  description:
    "Notes from a counselling psychologist on anxiety, academic stress, self-esteem, boundaries and the ordinary work of feeling better.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: `Writing — ${SITE_NAME}`,
    description:
      "Notes from a counselling psychologist on anxiety, academic stress, self-esteem and boundaries.",
    url: `${SITE_URL}/blog`,
    type: "website",
  },
};

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogIndexPage() {
  const [posts, content] = await Promise.all([getPublishedPosts(), getContent()]);

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${SITE_URL}/blog#blog`,
    name: `Writing — ${SITE_NAME}`,
    url: `${SITE_URL}/blog`,
    publisher: { "@id": `${SITE_URL}#business` },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: `${SITE_URL}/blog/${post.slug}`,
      datePublished: post.publishedAt || undefined,
      dateModified: post.updatedAt || undefined,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionJsonLd) }}
      />
      <Navbar />
      <main className="bg-cream min-h-screen">
        <section className="max-w-4xl mx-auto px-6 pt-32 pb-16">
          <p className="font-sans text-xs text-clay uppercase tracking-[0.2em] mb-4">
            Writing
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-forest mb-5">
            Things worth saying slowly.
          </h1>
          <p className="font-sans text-base text-forest/60 leading-relaxed max-w-2xl">
            Notes on anxiety, academic pressure, self-worth and boundaries — written
            for the people I usually meet in session, and anyone who recognises
            themselves in it.
          </p>
        </section>

        <section className="max-w-4xl mx-auto px-6 pb-28">
          {posts.length === 0 ? (
            <div className="bg-white/60 border border-sage/20 rounded-2xl py-20 text-center">
              <p className="font-serif text-xl text-forest/70 mb-2">
                Nothing published yet.
              </p>
              <p className="font-sans text-sm text-forest/45">
                The first piece is being written. In the meantime,{" "}
                <Link
                  href="/?intake=true"
                  className="text-clay underline underline-offset-2"
                >
                  the intake form
                </Link>{" "}
                is open.
              </p>
            </div>
          ) : (
            <ul className="space-y-6">
              {posts.map((post) => (
                <li key={post.id}>
                  <article className="group bg-white/70 border border-sage/20 rounded-2xl overflow-hidden hover:border-clay/40 transition-colors">
                    <Link href={`/blog/${post.slug}`} className="sm:flex">
                      {post.coverImage && (
                        <div className="sm:w-56 shrink-0 relative aspect-[16/10] sm:aspect-auto">
                          <Image
                            src={post.coverImage}
                            alt={post.coverAlt || ""}
                            fill
                            sizes="(max-width: 640px) 100vw, 224px"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="p-6 sm:p-7">
                        <div className="flex items-center gap-3 mb-2">
                          <time
                            dateTime={post.publishedAt}
                            className="font-sans text-xs text-forest/40"
                          >
                            {formatDate(post.publishedAt)}
                          </time>
                          <span className="font-sans text-xs text-forest/30">
                            {readingMinutes(post.content)} min read
                          </span>
                        </div>
                        <h2 className="font-serif text-2xl font-semibold text-forest mb-2 group-hover:text-clay transition-colors">
                          {post.title}
                        </h2>
                        {post.excerpt && (
                          <p className="font-sans text-sm text-forest/60 leading-relaxed">
                            {post.excerpt}
                          </p>
                        )}
                        {post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4">
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
                      </div>
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer
        instagram={content.social?.instagram}
        linkedin={content.social?.linkedin}
      />
    </>
  );
}
