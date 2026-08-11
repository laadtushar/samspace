import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getPublishedPosts,
  getPublishedPostBySlug,
  readingMinutes,
} from "@/lib/blog";
import { SITE_URL, serializeJsonLd } from "@/lib/site";
import { getContent } from "@/lib/content";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Markdown from "@/components/Markdown";

export const revalidate = 300;

/** Prerenders published posts at build time; new ones fill in on demand. */
export async function generateStaticParams() {
  const posts = await getPublishedPosts().catch(() => []);
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) return { title: "Post not found", robots: { index: false } };

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt;
  const url = `${SITE_URL}/blog/${post.slug}`;

  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: post.publishedAt || undefined,
      modifiedTime: post.updatedAt || undefined,
      authors: ["Priyanka Varma"],
      tags: post.tags,
      ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
    },
    twitter: {
      card: post.coverImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
  };
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const [post, content] = await Promise.all([
    getPublishedPostBySlug(params.slug),
    getContent(),
  ]);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#post`,
        headline: post.title,
        description: post.seoDescription || post.excerpt,
        url,
        datePublished: post.publishedAt || undefined,
        dateModified: post.updatedAt || undefined,
        keywords: post.tags.join(", ") || undefined,
        wordCount: post.content.trim().split(/\s+/).length,
        inLanguage: "en-IN",
        author: { "@id": `${SITE_URL}#priyanka` },
        publisher: { "@id": `${SITE_URL}#business` },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        ...(post.coverImage ? { image: post.coverImage } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Writing",
            item: `${SITE_URL}/blog`,
          },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Navbar />
      <main className="bg-cream min-h-screen">
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
            <div className="flex items-center gap-3 mb-4">
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

          {post.coverImage && (
            <Image
              src={post.coverImage}
              alt={post.coverAlt || ""}
              width={1200}
              height={675}
              priority
              sizes="(max-width: 672px) 100vw, 672px"
              className="rounded-2xl w-full h-auto mb-10"
            />
          )}

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
      </main>
      <Footer
        instagram={content.social?.instagram}
        linkedin={content.social?.linkedin}
      />
    </>
  );
}
