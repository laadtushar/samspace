"use client";

import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import MagneticButton from "./MagneticButton";
import TextReveal from "./TextReveal";
import AnimatedContactForm from "./AnimatedContactForm";

const infoCards = [
  { icon: "📧", label: "Email", value: "Priyankavarma785@gmail.com" },
  { icon: "📱", label: "WhatsApp / Call", value: "[Add before deploying]" },
  { icon: "🕐", label: "Response Time", value: "Within 24 hours" },
];

export default function Contact() {
  return (
    <section id="contact" className="bg-forest text-cream py-28 relative overflow-hidden">
      {/* Ambient orbs */}
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 right-20 w-72 h-72 rounded-full bg-sage/[0.06] blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ x: [0, -20, 0], y: [0, 25, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 left-20 w-60 h-60 rounded-full bg-clay/[0.04] blur-3xl pointer-events-none"
      />

      <div className="relative max-w-4xl mx-auto px-6">
        <AnimatedSection>
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl sm:text-5xl font-semibold mb-5">
              <TextReveal
                text="Ready to take the first step?"
                staggerDelay={0.06}
                className="text-cream"
              />
            </h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="font-sans text-base text-cream/55 max-w-md mx-auto"
            >
              Reach out to schedule your session. I&apos;ll respond within 24
              hours.
            </motion.p>
          </div>
        </AnimatedSection>

        {/* Info cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-16">
          {infoCards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: 0.2 + i * 0.12,
                ease: [0.23, 0.86, 0.39, 0.96],
              }}
              whileHover={{ y: -6, scale: 1.03 }}
              className="bg-cream/[0.06] backdrop-blur-sm border border-cream/[0.1] rounded-2xl p-7 text-center cursor-default group"
            >
              <motion.span
                className="text-3xl mb-3 block"
                whileHover={{ scale: 1.3 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {c.icon}
              </motion.span>
              <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-cream/40 mb-2">
                {c.label}
              </p>
              <p className="font-sans text-sm text-cream/85 font-medium break-all group-hover:text-clay transition-colors duration-300">
                {c.value}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Animated Contact Form */}
        <AnimatedContactForm />
      </div>
    </section>
  );
}
