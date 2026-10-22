"use client";

import { useEffect, useRef } from "react";
import { createSpring } from "./spring";

/**
 * The thin clay line under the header that fills as the page is read.
 *
 * It trails the scroll position on the same spring as before (stiffness 100,
 * damping 30), from spring.ts rather than framer-motion's useScroll and
 * useSpring, and writes its transform directly: a passive scroll listener and
 * one animation frame per frame of movement, nothing while the page is still.
 */
export default function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spring = createSpring(
      { stiffness: 100, damping: 30, restDelta: 0.001, restSpeed: 0.01 },
      [0],
      ([progress]) => {
        el.style.transform = `scaleX(${progress})`;
      }
    );
    const measure = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      spring.set([scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0]);
    };
    // At the top the bar is already right (empty), and measuring the page
    // height now would force a layout in the middle of hydration.
    if (window.scrollY > 0) measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      spring.stop();
    };
  }, []);

  return (
    <div
      ref={ref}
      className="fixed top-16 left-0 right-0 h-[2px] bg-clay z-50 origin-left"
      style={{ transform: "scaleX(0)" }}
    />
  );
}
