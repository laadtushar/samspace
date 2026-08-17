"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import SocialLinks from "./SocialLinks";

export default function Footer({
  instagram,
  linkedin,
}: {
  instagram?: string;
  linkedin?: string;
} = {}) {
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
        {/*
          The padding here is the tap target, not decoration: at text-xs these
          links were 16px tall, which is a hard thing to hit with a thumb. The
          negative margin keeps the footer looking the same while giving each
          one a 40px-high area to press.
        */}
        <nav className="flex items-center justify-center gap-3 mb-4 -my-2">
          <Link
            href="/"
            className="font-sans text-xs text-cream/50 hover:text-cream/80 transition-colors px-3 py-3"
          >
            Home
          </Link>
          <Link
            href="/blog"
            className="font-sans text-xs text-cream/50 hover:text-cream/80 transition-colors px-3 py-3"
          >
            Writing
          </Link>
          <a
            href="/blog/rss.xml"
            className="font-sans text-xs text-cream/50 hover:text-cream/80 transition-colors px-3 py-3"
          >
            RSS
          </a>
        </nav>
        <SocialLinks instagram={instagram} linkedin={linkedin} className="mb-5" />
        <p className="font-sans text-xs leading-relaxed">
          © {new Date().getFullYear()} Samvriti.Space · Priyanka Varma ·
          Counselling Psychologist &amp; Academic Mentor · All sessions conducted
          ethically under professional supervision
        </p>
      </motion.div>
    </footer>
  );
}
