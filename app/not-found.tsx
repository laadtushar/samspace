import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  getCachedContent,
  defaultContent,
  resolveContentTokens,
} from "@/lib/content";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * What a wrong URL looks like.
 *
 * There was no not-found page, so a renamed post, a mistyped link, or an old
 * address in an Instagram bio produced Next's stark default — black text on
 * white, the word "404", and no way onward. On a therapy site that is the first
 * impression for anyone arriving from a link that has since moved.
 *
 * The three routes out are the three reasons someone was here: to read, to book,
 * or to ask. Nothing apologises at length; a wrong URL is not the visitor's
 * fault and not worth dwelling on.
 */
export default async function NotFound() {
  const content = await getCachedContent().catch(() =>
    resolveContentTokens(defaultContent)
  );

  return (
    <>
      <Navbar />
      <main className="bg-cream min-h-[70vh] flex items-center">
        <div className="max-w-2xl mx-auto px-6 py-28 text-center">
          <p className="font-sans text-xs uppercase tracking-[0.3em] text-forest/40 mb-4">
            404
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-forest mb-5">
            This page isn&apos;t here
          </h1>
          <p className="font-sans text-base text-forest/65 leading-relaxed mb-10">
            The link may have moved, or it may never have existed. Nothing has
            gone wrong on your end.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/?intake=true"
              className="font-sans text-sm font-medium bg-clay text-cream px-6 py-3 rounded-full hover:bg-clay-light transition-colors"
            >
              Book a session
            </Link>
            <Link
              href="/blog"
              className="font-sans text-sm font-medium text-forest/80 hover:text-forest px-6 py-3 rounded-full border border-sage/40 hover:border-sage/70 transition-colors"
            >
              Read the writing
            </Link>
            <Link
              href="/#contact"
              className="font-sans text-sm font-medium text-forest/80 hover:text-forest px-6 py-3 rounded-full border border-sage/40 hover:border-sage/70 transition-colors"
            >
              Send a message
            </Link>
          </div>
        </div>
      </main>
      <Footer
        instagram={content.social.instagram}
        linkedin={content.social.linkedin}
      />
    </>
  );
}
