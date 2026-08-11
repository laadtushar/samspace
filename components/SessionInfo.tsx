"use client";

import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";

const stats = [
  { icon: "🕐", label: "Duration", value: "45–50 mins" },
  { icon: "💻", label: "Mode", value: "Online Only" },
  { icon: "🔒", label: "Privacy", value: "Fully Confidential" },
];

export default function SessionInfo() {
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
              <span className="font-semibold">⚠️ Important:</span> These
              sessions are not crisis or emergency care. If you are experiencing
              severe distress, suicidal thoughts, or require emergency support,
              please seek immediate help.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
              <span className="font-sans text-sm text-forest/65 bg-white/60 rounded-full px-4 py-2">
                📞 <strong>iCall:</strong> 9152987821
              </span>
              <span className="font-sans text-sm text-forest/65 bg-white/60 rounded-full px-4 py-2">
                📞 <strong>Vandrevala Foundation:</strong> 1860-2662-345 (24/7)
              </span>
            </div>
          </motion.div>
        </AnimatedSection>
      </div>
    </section>
  );
}
