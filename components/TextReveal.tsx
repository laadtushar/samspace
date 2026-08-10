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

  return (
    <span ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {/*
        The animated pieces carry no whitespace between them — the gaps are
        margins — so the text extracts as "Aspacetofeelseen". Crawlers and
        screen readers get the real string here instead, and the decorative
        copy is hidden from the accessibility tree.
      */}
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="contents">
      {parts.map((part, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={
            inView
              ? { opacity: 1, y: 0, filter: "blur(0px)" }
              : {}
          }
          transition={{
            duration: 0.6,
            ease: [0.23, 0.86, 0.39, 0.96],
            delay: delay + i * staggerDelay,
          }}
          className="inline-block mr-[0.3em] last:mr-0"
        >
          {part}
        </motion.span>
      ))}
      </span>
    </span>
  );
}
