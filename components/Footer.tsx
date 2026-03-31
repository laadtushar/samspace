"use client";

import { motion } from "framer-motion";

export default function Footer() {
  return (
    <footer className="bg-forest-deep text-cream/40 py-10 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-6xl mx-auto px-6 text-center"
      >
        <p className="font-serif text-lg text-cream/50 mb-3">Samvriti.Space</p>
        <p className="font-sans text-xs leading-relaxed">
          © 2025 Samvriti.Space · Priyanka Varma · Counselling Psychologist &
          Academic Mentor · All sessions conducted ethically under professional
          supervision
        </p>
      </motion.div>
    </footer>
  );
}
