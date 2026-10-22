import { shareImage } from "@/lib/brand";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedPublishedPosts, getPublishedPostBySlug } from "@/lib/blog";
import { SITE_URL, serializeJsonLd, absoluteUrl, withoutSiteSuffix, pageTitle } from "@/lib/site";
import { AUTHOR, AUTHOR_REFERENCE } from "@/lib/author";
import { publicContent } from "@/lib/content";
import { publicPost } from "@/lib/posts-public";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PostArticle from "@/components/PostArticle";

export const revalidate = 300;

/** Prerenders published posts at build time; new ones fill in on demand. */
export async function generateStaticParams() {
  const posts = await getCachedPublishedPosts().catch(() => []);
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const stored = await getPublishedPostBySlug(params.slug);
  if (!stored) return { title: "Post not found", robots: { index: false } };

  // The same resolution the page does — an SEO title quoting {{rate.range}}
  // would otherwise reach the search result with the braces still in it.
  const content = await publicContent();
  const post = publicPost(stored, content.slidingScale);

  const title = withoutSiteSuffix(post.seoTitle || post.title);
  const description = post.seoDescription || post.excerpt;
  const url = `${SITE_URL}/blog/${post.slug}`;

  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: post.publishedAt || undefined,
      modifiedTime: post.updatedAt || undefined,
      authors: [AUTHOR.name],
      tags: post.tags,
      ...shareImage(post.coverImage),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...shareImage(post.coverImage),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const [stored, content] = await Promise.all([
    getPublishedPostBySlug(params.slug),
    publicContent(),
  ]);
  if (!stored) notFound();

  /*
    A post can write {{rate.range}} rather than the figure, so a rate change
    does not mean editing five published posts by hand — which is how the site
    ended up quoting two prices at once the last time one changed.

    Filled here rather than in storage: the dashboard editor has to show the
    token, and the word count and structured data below should describe what a
    reader actually sees.
  */
  const post = publicPost(stored, content.slidingScale);

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
        author: AUTHOR_REFERENCE,
        publisher: { "@id": `${SITE_URL}#business` },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        ...(post.coverImage ? { image: absoluteUrl(post.coverImage) } : {}),
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
        <PostArticle post={post} />
      </main>
      <Footer
        instagram={content.social?.instagram}
        linkedin={content.social?.linkedin}
      />
    </>
  );
}
