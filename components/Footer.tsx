"use client";

import { motion } from "framer-motion";
import Link from "next/link";

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
        <nav className="flex items-center justify-center gap-5 mb-4">
          <Link
            href="/"
            className="font-sans text-xs text-cream/50 hover:text-cream/80 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/blog"
            className="font-sans text-xs text-cream/50 hover:text-cream/80 transition-colors"
          >
            Writing
          </Link>
          <a
            href="/blog/rss.xml"
            className="font-sans text-xs text-cream/50 hover:text-cream/80 transition-colors"
          >
            RSS
          </a>
        </nav>
        <p className="font-sans text-xs leading-relaxed">
          © {new Date().getFullYear()} Samvriti.Space · Priyanka Varma ·
          Counselling Psychologist &amp; Academic Mentor · All sessions conducted
          ethically under professional supervision
        </p>
      </motion.div>
    </footer>
  );
}
