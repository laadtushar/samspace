import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { getCachedPublishedPages, getPublishedPageBySlug } from "@/lib/pages";
import { publicContent } from "@/lib/content";
import { publicPage } from "@/lib/pages-public";
import { SITE_URL, SITE_NAME, serializeJsonLd, withoutSiteSuffix, pageTitle } from "@/lib/site";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageArticle from "@/components/PageArticle";

/**
 * A published standalone page, at /<slug>.
 *
 * Published pages only. A draft answers the same 404 as a slug nobody has
 * used, whoever is asking — admins preview drafts under /preview, so this
 * route never reads a cookie and stays cacheable for everyone.
 *
 * Next serves its own routes ahead of this one, so /blog, /admin and the rest
 * are never shadowed; the reserved list in lib/page-format.ts is what stops a
 * page being created under one of those names in the first place.
 */

export const revalidate = 300;

/** Prerenders published pages at build time; new ones fill in on demand. */
export async function generateStaticParams() {
  const pages = await getCachedPublishedPages().catch(() => []);
  return pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const stored = await getPublishedPageBySlug(params.slug);
  if (!stored) return { title: "Page not found", robots: { index: false } };

  // Resolved as the page is, so a search title quoting a rate shows the figure.
  const page = publicPage(stored, await publicContent());
  const title = withoutSiteSuffix(page.seoTitle || page.title);
  const description = page.seoDescription || undefined;

  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${page.slug}`,
      type: "website",
      siteName: SITE_NAME,
      images: [BRAND.ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [BRAND.ogImage.url],
    },
  };
}

export default async function StandalonePage({
  params,
}: {
  params: { slug: string };
}) {
  const [stored, content] = await Promise.all([
    getPublishedPageBySlug(params.slug),
    publicContent(),
  ]);
  if (!stored) notFound();

  const page = publicPage(stored, content);
  const url = `${SITE_URL}/${page.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#page`,
    url,
    name: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    inLanguage: "en-IN",
    isPartOf: { "@id": `${SITE_URL}#website` },
    about: { "@id": `${SITE_URL}#business` },
    dateModified: page.updatedAt || undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Navbar />
      <main className="bg-cream min-h-screen">
        <PageArticle page={page} />
      </main>
      <Footer
        instagram={content.social?.instagram}
        linkedin={content.social?.linkedin}
      />
    </>
  );
}
