"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { PublicSiteContent } from "@/lib/content";
import type { BlogPost } from "@/lib/blog";
import IntakeFormModal from "./IntakeFormModal";
import SocialLinks from "./SocialLinks";

/**
 * The one link that goes in an Instagram bio.
 *
 * Built for a thumb on a phone that has just left a reel: one column, large
 * targets, no navigation to get lost in, and the intake form opening in place
 * rather than bouncing through the homepage — every extra hop loses people.
 *
 * It lives on this domain rather than a link-in-bio service so the traffic
 * shows up in analytics that belong to the practice, and so the page can say
 * something rather than being a list of naked buttons.
 */
export default function StartPage({
  content,
  latestPost,
}: {
  content: PublicSiteContent;
  latestPost: BlogPost | null;
}) {
  const [intakeOpen, setIntakeOpen] = useState(false);
  const { startPage } = content;

  const isIntake = (href: string) => href.startsWith("/?intake");

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-md mx-auto px-6 py-14 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <Image
            src="/priyanka.jpeg"
            alt="Priyanka Varma"
            width={96}
            height={96}
            priority
            className="w-24 h-24 rounded-full object-cover mx-auto mb-5 shadow-lg shadow-forest/10"
          />
          <h1 className="font-serif text-3xl font-semibold text-forest mb-1">
            Samvriti.Space
          </h1>
          <p className="font-sans text-xs text-sage uppercase tracking-[0.18em] mb-6">
            Priyanka Varma · Counselling Psychologist
          </p>

          {startPage.heading && (
            <h2 className="font-serif text-xl text-forest/90 mb-2">
              {startPage.heading}
            </h2>
          )}
          {startPage.subtext && (
            <p className="font-sans text-sm text-forest/55 leading-relaxed mb-9">
              {startPage.subtext}
            </p>
          )}
        </motion.div>

        <div className="flex flex-col gap-3">
          {startPage.links
            .filter((l) => l.href && l.label)
            .map((link, i) => {
              const inner = (
                <>
                  <span className="flex-1">
                    <span className="block font-sans text-sm font-medium text-forest">
                      {link.label}
                    </span>
                    {link.description && (
                      <span className="block font-sans text-xs text-forest/45 mt-0.5 leading-relaxed">
                        {link.description}
                      </span>
                    )}
                  </span>
                  <ArrowUpRight
                    className="w-4 h-4 text-forest/25 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                </>
              );

              const className =
                "w-full text-left bg-white border border-sage/20 rounded-2xl px-5 py-4 flex items-start gap-3 hover:border-clay/40 hover:shadow-md hover:shadow-forest/5 transition-all duration-200";

              return (
                <motion.div
                  key={`${link.href}-${i}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
                >
                  {/* The form opens here rather than sending someone to the
                      homepage first — the fewer hops from a reel, the better. */}
                  {isIntake(link.href) ? (
                    <button
                      type="button"
                      onClick={() => setIntakeOpen(true)}
                      className={className}
                    >
                      {inner}
                    </button>
                  ) : link.href.startsWith("/") && !link.href.startsWith("//") ? (
                    <Link href={link.href} className={className}>
                      {inner}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={className}
                    >
                      {inner}
                    </a>
                  )}
                </motion.div>
              );
            })}
        </div>

        {latestPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.45 }}
            className="mt-9"
          >
            <p className="font-sans text-[10px] text-forest/35 uppercase tracking-[0.18em] mb-2">
              Latest
            </p>
            <Link
              href={`/blog/${latestPost.slug}`}
              className="block bg-forest text-cream rounded-2xl px-5 py-4 hover:bg-forest-deep transition-colors"
            >
              <span className="block font-serif text-base leading-snug mb-1">
                {latestPost.title}
              </span>
              {latestPost.excerpt && (
                <span className="block font-sans text-xs text-cream/55 leading-relaxed">
                  {latestPost.excerpt.slice(0, 110)}
                  {latestPost.excerpt.length > 110 ? "…" : ""}
                </span>
              )}
            </Link>
          </motion.div>
        )}

        <SocialLinks
          instagram={content.social?.instagram}
          linkedin={content.social?.linkedin}
          tone="light"
          className="mt-10"
        />

        <p className="font-sans text-[11px] text-forest/35 text-center mt-8 leading-relaxed">
          Sessions are online and confidential. Not for crisis or emergency
          support — if you are in immediate distress, please seek urgent help.
        </p>
      </div>

      <IntakeFormModal
        isOpen={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        slidingScale={content.slidingScale}
        calendlyUrl={content.calendlyUrl}
        studentNote={content.studentNote}
      />
    </main>
  );
}
