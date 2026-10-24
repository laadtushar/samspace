"use client";

import { useRef } from "react";
import { useScrollProgress } from "./useScrollProgress";

/**
 * A paragraph that brightens word by word as it is scrolled through.
 *
 * The reveal is tied to scroll position rather than time, so the reader sets
 * the pace. Every word is in the DOM at full strength for crawlers and screen
 * readers; only its opacity is dimmed, and anyone asking for reduced motion
 * gets the plain paragraph.
 *
 * One custom property does the work: the scroll position writes `--p` on the
 * paragraph (0 to 1, once per frame while it is on screen), and each word's
 * opacity is worked out from it in CSS (.scroll-words in motion.css) — the
 * same per-word ramp from `dim` to 1 that framer-motion computed in JavaScript
 * for every word on every frame.
 *
 * The words are numbered for that CSS here, the first time the paragraph nears
 * the screen, rather than in the server HTML: sixty-odd inline custom
 * properties made the page's first style pass measurably slower, for a
 * paragraph nobody can see yet. Until then, and without JavaScript, the
 * paragraph is simply at full strength.
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
  useScrollProgress(ref, [0.85, 0.45], (progress) => {
    const p = ref.current;
    if (!p) return;
    if (!p.dataset.progress) {
      p.style.setProperty("--n", String(p.children.length));
      p.style.setProperty("--dim", String(dim));
      Array.from(p.children).forEach((word, i) =>
        (word as HTMLElement).style.setProperty("--i", String(i))
      );
      p.dataset.progress = "on";
    }
    p.style.setProperty("--p", String(progress));
  });

  const words = text.split(" ");
  return (
    <p ref={ref} className={`scroll-words ${className}`}>
      {words.map((word, i) => (
        <span key={i}>{i < words.length - 1 ? `${word} ` : word}</span>
      ))}
    </p>
  );
}
