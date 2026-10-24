"use client";

import { useEffect, type RefObject } from "react";
import { prefersReducedMotion } from "./spring";

/**
 * How far an element has been scrolled through, 0 to 1, for scroll-linked
 * effects (the About parallax, ScrollText). The replacement for framer-motion's
 * `useScroll({ target, offset })`.
 *
 * `start` and `end` are framer-motion's offsets as fractions of the viewport:
 * progress is 0 when the element's top reaches `start` of the way down the
 * screen and 1 when its bottom reaches `end`. ["start end", "end start"] is
 * `[1, 0]`; ["start 0.85", "end 0.45"] is `[0.85, 0.45]`.
 *
 * It listens only while the element is on screen, does its reading and writing
 * once per frame, and does nothing at all for anyone who has asked their device
 * for reduced motion: these effects are motion, and the content they decorate
 * is already complete without them.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement>,
  [start, end]: [number, number],
  onProgress: (progress: number) => void
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = (start * vh - rect.top) / (rect.height + (start - end) * vh);
      onProgress(Math.min(1, Math.max(0, progress)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    let listening = false;
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
      } else {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
      }
    };

    // Only while the element is within half a screen of being seen, so it is
    // already in the right state when it appears; plus once on the way out, so
    // a fast scroll past still leaves it at its end state. Nothing is measured
    // while the page hydrates.
    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasListening = listening;
        listen(entry.isIntersecting);
        if (entry.isIntersecting || wasListening) schedule();
      },
      { rootMargin: "50% 0px" }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      listen(false);
      cancelAnimationFrame(frame);
    };
    // The offsets and callback are fixed for a component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
