"use client";

import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import RelatedReading, { type PostLink } from "./RelatedReading";

const SHIPPED_SESSION_LENGTH = "45–50 minutes";

/** Duration comes from content; the other two are what this practice is. */
const statsFor = (sessionLength: string) => [
  { icon: "🕐", label: "Duration", value: sessionLength },
  { icon: "💻", label: "Mode", value: "Online Only" },
  { icon: "🔒", label: "Privacy", value: "Fully Confidential" },
];

interface SessionInfoProps {
  structure?: {
    heading: string;
    intro: string;
    steps: { title: string; desc: string }[];
  };
  crisis?: {
    notice: string;
    helplines: { name: string; number: string; note: string }[];
  };
  sessionLength?: string;
  posts?: PostLink[];
}

/**
 * What this section says when content has not reached it.
 *
 * The crisis notice is the one piece of copy on this site that must not be able
 * to render empty. A storage failure, or a content document written before this
 * field existed, has to leave the numbers on the page rather than take them off
 * it — so the shipped wording is the floor, not the default.
 */
const FALLBACK_CRISIS = {
  notice:
    "These sessions are not crisis or emergency care. If you are experiencing severe distress, suicidal thoughts, or require emergency support, please seek immediate help.",
  helplines: [
    { name: "iCall", number: "9152987821", note: "" },
    { name: "Vandrevala Foundation", number: "1860-2662-345", note: "24/7" },
  ],
};

export default function SessionInfo({
  structure,
  crisis,
  sessionLength,
  posts = [],
}: SessionInfoProps) {
  const stats = statsFor(sessionLength?.trim() || SHIPPED_SESSION_LENGTH);
  const notice = crisis?.notice?.trim() || FALLBACK_CRISIS.notice;
  const helplines =
    crisis?.helplines && crisis.helplines.length > 0
      ? crisis.helplines
      : FALLBACK_CRISIS.helplines;
  /*
    The three icons — duration, mode, confidentiality — answer the logistics and
    none of the hesitation. What stops people who have already
    decided to book is not knowing what the hour is, so the walkthrough belongs
    here — at the point of the decision — rather than only in the post.

    Optional, because this section rendered without props before and a stored
    content document written before the field existed has no value for it.
  */
  const steps = structure?.steps ?? [];
  const fullPost = posts.find(
    (post) => post.slug === "what-happens-first-therapy-session"
  );
  return (
    <section className="bg-white py-28 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <AnimatedSection>
          {/* This section carries the crisis-care notice — the single most
              important thing on the page for someone in trouble — and had no
              heading, so nothing indexed or announced it. */}
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-forest text-center mb-3">
            How sessions work
          </h2>
          <p className="font-sans text-sm text-forest/55 text-center max-w-xl mx-auto mb-12">
            Practical details before you book — format, length, and what these
            sessions are and aren&apos;t for.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-14">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.12,
                  ease: [0.23, 0.86, 0.39, 0.96],
                }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="bg-cream rounded-2xl p-10 text-center border border-sage/10 cursor-default group"
              >
                <motion.span
                  className="text-4xl mb-4 block"
                  whileHover={{ scale: 1.3, rotate: 15 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  {s.icon}
                </motion.span>
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-forest/40 mb-2">
                  {s.label}
                </p>
                <p className="font-serif text-xl font-semibold text-forest group-hover:text-clay transition-colors duration-300">
                  {s.value}
                </p>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>

        {steps.length > 0 && (
          <AnimatedSection delay={0.1}>
            <div className="max-w-3xl mx-auto mb-14">
              <h3 className="font-serif text-2xl sm:text-3xl font-semibold text-forest text-center mb-3">
                {structure!.heading}
              </h3>
              <p className="font-sans text-sm text-forest/55 text-center leading-relaxed mb-10">
                {structure!.intro}
              </p>

              <ol className="relative border-l border-sage/25 ml-3 space-y-7">
                {steps.map((step, i) => (
                  <motion.li
                    key={step.title}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.5,
                      delay: i * 0.1,
                      ease: [0.23, 0.86, 0.39, 0.96],
                    }}
                    className="pl-7"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -left-[7px] w-3.5 h-3.5 rounded-full bg-clay/70 ring-4 ring-white"
                    />
                    <p className="font-sans text-sm font-semibold text-forest mb-1.5">
                      {step.title}
                    </p>
                    <p className="font-sans text-sm text-forest/60 leading-relaxed">
                      {step.desc}
                    </p>
                  </motion.li>
                ))}
              </ol>

              {fullPost && (
                <RelatedReading
                  posts={[fullPost]}
                  label="The longer version, including how people tend to feel afterwards:"
                  className="mt-9 pt-7 border-t border-sage/15"
                />
              )}
            </div>
          </AnimatedSection>
        )}

        <AnimatedSection delay={0.2}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-gradient-to-r from-clay/[0.08] via-clay/[0.12] to-clay/[0.08] border border-clay/20 rounded-2xl p-8 text-center relative overflow-hidden"
          >
            {/* Animated border glow */}
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 left-0 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-clay/60 to-transparent"
            />

            <p className="font-sans text-sm text-forest/75 leading-relaxed max-w-2xl mx-auto">
              <span className="font-semibold">⚠️ Important:</span> {notice}
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 mt-6">
              {helplines.map((line) => (
                <a
                  key={`${line.name}-${line.number}`}
                  // Dialable. On a phone, in the moment this text is for,
                  // reading a number off the screen and typing it is a step too
                  // many.
                  href={`tel:${line.number.replace(/[^\d+]/g, "")}`}
                  className="font-sans text-sm text-forest/65 bg-white/60 rounded-full px-4 py-2 hover:bg-white hover:text-forest transition-colors"
                >
                  📞 <strong>{line.name}:</strong> {line.number}
                  {line.note ? ` (${line.note})` : ""}
                </a>
              ))}
            </div>
          </motion.div>
        </AnimatedSection>
      </div>
    </section>
  );
}
