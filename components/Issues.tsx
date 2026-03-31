"use client";

import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import MagneticButton from "./MagneticButton";
import TextReveal from "./TextReveal";

const issues = [
  "Academic stress & burnout",
  "Anxiety & overthinking",
  "Low self-esteem & self-doubt",
  "Emotional overwhelm",
  "Relationship concerns & boundaries",
  "Adjustment issues",
  "Guilt, shame & identity concerns",
  "Stress from exams or life transitions",
];

export default function Issues() {
  return (
    <section className="bg-white py-28 relative overflow-hidden">
      {/* Animated background orb */}
      <motion.div
        animate={{
          x: [0, 40, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-sage/[0.04] blur-3xl pointer-events-none"
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <AnimatedSection>
            <span className="font-sans text-xs font-medium tracking-[0.3em] uppercase text-clay mb-4 block">
              Areas of Support
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl font-semibold text-forest mb-6 leading-tight">
              <TextReveal
                text="What we can work through together"
                staggerDelay={0.05}
              />
            </h2>
            <p className="font-sans text-base text-forest/55 leading-relaxed">
              These are some of the common concerns I work with. If your
              experience isn&apos;t listed here, reach out — we can discuss
              whether my approach is the right fit for you.
            </p>
          </AnimatedSection>

          {/* Right — magnetic pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {issues.map((issue, i) => (
              <motion.div
                key={issue}
                initial={{ opacity: 0, x: 30, filter: "blur(6px)" }}
                whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: 0.1 + i * 0.07,
                  ease: [0.23, 0.86, 0.39, 0.96],
                }}
              >
                <MagneticButton strength={0.2} className="w-full">
                  <div className="bg-cream border border-sage/20 rounded-xl px-5 py-4 font-sans text-sm text-forest/75 hover:border-clay/50 hover:bg-clay/[0.04] hover:text-forest transition-all duration-300 cursor-default w-full">
                    {issue}
                  </div>
                </MagneticButton>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
