"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";

/**
 * A paragraph that brightens word by word as it is scrolled through.
 *
 * The reveal is tied to scroll position rather than time, so the reader sets
 * the pace. Every word is in the DOM at full strength for crawlers and screen
 * readers; only its opacity is dimmed, and anyone asking for reduced motion
 * gets the plain paragraph.
 */
export default function ScrollText({
  text,
  className = "",
  dim = 0.18,
}: {
  text: string;
  className?: string;
  /** Opacity of a word before it is reached. */
  dim?: number;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.45"],
  });

  if (reduce) return <p className={className}>{text}</p>;

  const words = text.split(" ");
  return (
    <p ref={ref} className={className}>
      {words.map((word, i) => (
        <Word
          key={i}
          progress={scrollYProgress}
          range={[i / words.length, (i + 1) / words.length]}
          dim={dim}
        >
          {i < words.length - 1 ? `${word} ` : word}
        </Word>
      ))}
    </p>
  );
}

function Word({
  children,
  progress,
  range,
  dim,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
  dim: number;
}) {
  const opacity = useTransform(progress, range, [dim, 1]);
  return <motion.span style={{ opacity }}>{children}</motion.span>;
}
