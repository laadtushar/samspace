import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { publicContent } from "@/lib/content";
import { publicPosts } from "@/lib/posts-public";
import { getCachedPublishedPosts } from "@/lib/blog";
import { SITE_URL, SITE_NAME, serializeJsonLd } from "@/lib/site";
import { AUTHOR, AUTHOR_URL, authorPerson } from "@/lib/author";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const revalidate = 300;

export const metadata: Metadata = {
  title: `${AUTHOR.name} — ${AUTHOR.jobTitle}`,
  description: AUTHOR.summary,
  alternates: { canonical: AUTHOR.path },
  openGraph: {
    type: "profile",
    url: AUTHOR_URL,
    title: `${AUTHOR.name} — ${AUTHOR.jobTitle}`,
    description: AUTHOR.summary,
    siteName: SITE_NAME,
  },
};

/**
 * The author page every byline links to.
 *
 * Health writing is judged partly on who wrote it, so the credentials sit here
 * in plain text, beside the writing they stand behind. The About copy is the
 * same admin-edited text the home page shows.
 */
export default async function AboutPage() {
  const [stored, content] = await Promise.all([getCachedPublishedPosts(), publicContent()]);
  const posts = publicPosts(stored, content.slidingScale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${AUTHOR_URL}#page`,
    url: AUTHOR_URL,
    name: `${AUTHOR.name} — ${SITE_NAME}`,
    isPartOf: { "@id": `${SITE_URL}#website` },
    mainEntity: authorPerson(content),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Navbar />
      <main className="bg-cream min-h-screen">
        <section className="max-w-4xl mx-auto px-6 pt-32 pb-12">
          <div className="flex flex-col sm:flex-row gap-8 sm:items-center">
            <Image
              src={AUTHOR.image}
              alt={`${AUTHOR.name} — ${AUTHOR.jobTitle}`}
              width={160}
              height={160}
              className="rounded-2xl object-cover w-40 h-40 shrink-0"
              priority
            />
            <div>
              <p className="font-sans text-xs text-clay uppercase tracking-[0.2em] mb-3">
                About the author
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-forest mb-2">
                {AUTHOR.name}
              </h1>
              <p className="font-sans text-base text-forest/60">{AUTHOR.jobTitle}</p>
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-6 pb-12">
          <h2 className="font-serif text-2xl font-semibold text-forest mb-4">
            {content.about.heading}
          </h2>
          <p className="font-sans text-base text-forest/70 leading-relaxed max-w-2xl mb-8">
            {content.about.paragraph}
          </p>

          <h2 className="font-serif text-xl font-semibold text-forest mb-3">Qualifications</h2>
          <ul className="font-sans text-sm text-forest/70 space-y-1.5 mb-8 list-disc pl-5">
            {AUTHOR.credentials.map((credential) => (
              <li key={credential}>{credential}</li>
            ))}
          </ul>

          <h2 className="font-serif text-xl font-semibold text-forest mb-3">Works with</h2>
          <ul className="flex flex-wrap gap-2 mb-10">
            {AUTHOR.knowsAbout.map((area) => (
              <li
                key={area}
                className="font-sans text-xs text-forest/70 bg-white/70 border border-sage/20 rounded-full px-3 py-1"
              >
                {area}
              </li>
            ))}
          </ul>

          <Link
            href="/?intake=true"
            className="inline-block font-sans text-sm text-cream bg-forest hover:bg-clay rounded-full px-6 py-3 transition-colors"
          >
            Start with the intake form
          </Link>
        </section>

        {posts.length > 0 && (
          <section className="max-w-4xl mx-auto px-6 pb-28">
            <h2 className="font-serif text-2xl font-semibold text-forest mb-5">
              Writing by {AUTHOR.name.split(" ")[0]}
            </h2>
            <ul className="space-y-3">
              {posts.map((post) => (
                <li key={post.id}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="font-sans text-base text-forest underline underline-offset-2 decoration-forest/25 hover:text-clay transition-colors"
                  >
                    {post.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
