"use client";

import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import TiltCard from "./TiltCard";
import TextReveal from "./TextReveal";

const card1Items = [
  "Exploring career options (psychology & beyond)",
  "Understanding streams, courses & entrance exams",
  "Clarifying interests, strengths & suitability",
  "Reducing confusion, comparison & pressure",
  "Parental expectation stress (discussion & planning)",
  "Building realistic short-term academic goals",
];

const card2Items = [
  "Career options after BA / MA Psychology",
  "NET-JRF & GATE preparation strategy",
  "Study planning & time management",
  "Managing academic stress & burnout",
  "Research & higher education guidance",
];

export default function Mentoring() {
  return (
    <section
      id="mentoring"
      className="bg-gradient-to-b from-cream via-white to-cream py-28 relative overflow-hidden"
    >
      {/* Decorative floating shapes */}
      <motion.div
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 right-10 w-40 h-40 rounded-full bg-sage/[0.06] blur-2xl pointer-events-none"
      />
      <motion.div
        animate={{ y: [0, 15, 0], rotate: [0, -3, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 left-10 w-32 h-32 rounded-full bg-clay/[0.05] blur-2xl pointer-events-none"
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <AnimatedSection>
          <div className="text-center mb-6">
            <span className="font-sans text-xs font-medium tracking-[0.3em] uppercase text-clay mb-4 block">
              Academic Mentoring
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl font-semibold text-forest mb-5">
              <TextReveal text="Clarity for your psychology journey." staggerDelay={0.06} />
            </h2>
            <p className="font-sans text-base text-forest/55 max-w-2xl mx-auto leading-relaxed mb-4">
              Evidence-informed mentorship — not therapy — focused on academic
              direction, exam strategy, and career clarity in psychology.
            </p>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="font-sans text-sm text-forest/45 italic max-w-xl mx-auto"
            >
              ⚠️ These sessions are not psychotherapy and do not involve clinical
              diagnosis or treatment.
            </motion.p>
          </div>
        </AnimatedSection>

        <div
          className="grid md:grid-cols-2 gap-8 mt-14"
          style={{ perspective: "1000px" }}
        >
          {/* Card 1 */}
          <AnimatedSection delay={0.1}>
            <TiltCard className="h-full">
              <div className="bg-white rounded-2xl p-8 border border-sage/15 h-full group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-sage/[0.06] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-sage/[0.12] transition-all duration-700" />
                <div className="relative">
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                    className="text-4xl mb-5 inline-block"
                  >
                    📚
                  </motion.div>
                  <h3 className="font-serif text-2xl font-semibold text-forest mb-6">
                    For 11th & 12th Students
                  </h3>
                  <ul className="space-y-3.5">
                    {card1Items.map((item, i) => (
                      <motion.li
                        key={item}
                        initial={{ opacity: 0, x: -15 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                        className="flex items-start gap-3 group/item"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-clay mt-2 flex-shrink-0 group-hover/item:scale-150 transition-transform duration-200" />
                        <span className="font-sans text-sm text-forest/65 leading-relaxed group-hover/item:text-forest/85 transition-colors duration-200">
                          {item}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </TiltCard>
          </AnimatedSection>

          {/* Card 2 */}
          <AnimatedSection delay={0.25}>
            <TiltCard className="h-full">
              <div className="bg-white rounded-2xl p-8 border border-sage/15 h-full group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-clay/[0.05] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-clay/[0.1] transition-all duration-700" />
                <div className="relative">
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                    className="text-4xl mb-5 inline-block"
                  >
                    🎓
                  </motion.div>
                  <h3 className="font-serif text-2xl font-semibold text-forest mb-6">
                    For Psychology Students (BA/BSc/MA)
                  </h3>
                  <ul className="space-y-3.5">
                    {card2Items.map((item, i) => (
                      <motion.li
                        key={item}
                        initial={{ opacity: 0, x: -15 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: 0.35 + i * 0.08 }}
                        className="flex items-start gap-3 group/item"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-clay mt-2 flex-shrink-0 group-hover/item:scale-150 transition-transform duration-200" />
                        <span className="font-sans text-sm text-forest/65 leading-relaxed group-hover/item:text-forest/85 transition-colors duration-200">
                          {item}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </TiltCard>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
