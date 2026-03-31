"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import TextReveal from "./TextReveal";

const features = [
  {
    icon: "🌿",
    title: "Eclectic Approach",
    desc: "CBT, Humanistic Therapy, Trauma-Informed Care",
  },
  {
    icon: "🛡️",
    title: "Safe & Ethical",
    desc: "Sessions under professional supervision, strict confidentiality",
  },
  {
    icon: "🌱",
    title: "Growth-Focused",
    desc: "Building insight, emotional regulation, healthier coping strategies",
  },
];

const credentialCards = [
  { label: "M.A. Clinical Psychology", icon: "🎓" },
  { label: "UGC NET-JRF", icon: "📜" },
  { label: "GATE (Psychology)", icon: "🏆" },
  { label: "Lecturer", icon: "📖" },
];

export default function About() {
  const sectionRef = useRef(null);
  const headingRef = useRef(null);
  const headingInView = useInView(headingRef, { once: true, margin: "-80px" });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative bg-forest text-cream py-28 overflow-hidden"
    >
      {/* Parallax subtle pattern */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 pointer-events-none"
      >
        <div className="absolute top-20 right-20 w-80 h-80 rounded-full bg-sage/[0.06] blur-3xl" />
        <div className="absolute bottom-20 left-10 w-60 h-60 rounded-full bg-clay/[0.04] blur-3xl" />
      </motion.div>

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left */}
          <div>
            <div ref={headingRef}>
              <h2 className="font-serif text-4xl sm:text-5xl font-semibold mb-8 leading-tight">
                <TextReveal
                  text="Qualified. Compassionate. Evidence-based."
                  delay={0}
                  staggerDelay={0.05}
                  className="text-cream"
                />
              </h2>
            </div>

            <AnimatedSection delay={0.3}>
              <p className="font-sans text-base text-cream/70 leading-relaxed mb-12">
                I&apos;m Priyanka Varma — a Lecturer, UGC NET-JRF &
                GATE-qualified psychologist with a Master&apos;s in Clinical
                Psychology, working under the banner of Samvriti.Space. I work
                with young adults experiencing emotional distress, academic
                stress, and personal growth challenges using an eclectic approach
                drawing from CBT, Humanistic Therapy, and Trauma-Informed Care —
                tailored to your unique needs and comfort.
              </p>
            </AnimatedSection>

            <div className="space-y-6">
              {features.map((f, i) => (
                <AnimatedSection key={f.title} delay={0.4 + i * 0.15}>
                  <motion.div
                    whileHover={{ x: 8 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex items-start gap-4 group cursor-default"
                  >
                    <span className="text-2xl mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      {f.icon}
                    </span>
                    <div>
                      <h3 className="font-sans text-sm font-semibold text-cream tracking-wide mb-1 group-hover:text-clay transition-colors duration-300">
                        {f.title}
                      </h3>
                      <p className="font-sans text-sm text-cream/55">{f.desc}</p>
                    </div>
                  </motion.div>
                </AnimatedSection>
              ))}
            </div>
          </div>

          {/* Right — photo + credential cards */}
          <div>
            <AnimatedSection delay={0.15}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="relative w-48 h-48 mx-auto mb-8 rounded-3xl overflow-hidden border-2 border-cream/15 shadow-2xl shadow-black/30"
              >
                <Image
                  src="/priyanka.jpeg"
                  alt="Priyanka Varma — Counselling Psychologist"
                  width={192}
                  height={192}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest/40 to-transparent" />
              </motion.div>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <div className="grid grid-cols-2 gap-4">
              {credentialCards.map((c, i) => (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, y: 30, rotate: -3 }}
                  whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: 0.3 + i * 0.12,
                    ease: [0.23, 0.86, 0.39, 0.96],
                  }}
                  whileHover={{
                    y: -8,
                    scale: 1.03,
                    transition: { duration: 0.3 },
                  }}
                  className="bg-cream/[0.07] backdrop-blur-sm border border-cream/[0.12] rounded-2xl p-7 flex flex-col items-center justify-center text-center gap-3 cursor-default group"
                >
                  <motion.span
                    className="text-3xl"
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    {c.icon}
                  </motion.span>
                  <span className="font-serif text-base font-medium text-cream/85 group-hover:text-cream transition-colors duration-300">
                    {c.label}
                  </span>
                </motion.div>
              ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </section>
  );
}
