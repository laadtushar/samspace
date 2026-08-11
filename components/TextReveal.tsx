"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

interface TextRevealProps {
  text: string;
  className?: string;
  splitBy?: "word" | "character";
  delay?: number;
  staggerDelay?: number;
}

export default function TextReveal({
  text,
  className = "",
  splitBy = "word",
  delay = 0,
  staggerDelay = 0.04,
}: TextRevealProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const parts = splitBy === "word" ? text.split(" ") : text.split("");

  /*
    Each piece keeps the space that followed it, and the spaces are real text
    nodes rather than margins. That matters more than it looks: the previous
    version spaced the words with CSS, so the heading extracted as
    "Aspacetofeelseen" — and the workaround was a second, screen-reader-only
    copy of the whole string. Anything reading the page therefore saw every
    heading twice. One correctly-spaced copy serves both readers and crawlers.
  */
  return (
    <span ref={ref} className={`inline ${className}`}>
      {parts.map((part, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
          transition={{
            duration: 0.6,
            ease: [0.23, 0.86, 0.39, 0.96],
            delay: delay + i * staggerDelay,
          }}
          className="inline-block"
        >
          {part}
          {splitBy === "word" && i < parts.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}
