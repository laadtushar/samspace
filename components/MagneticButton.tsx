"use client";

import { useEffect, useRef } from "react";
import { createSpring, prefersReducedMotion, type Spring } from "./spring";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  as?: "button" | "div" | "a";
  onClick?: () => void;
  strength?: number;
}

/**
 * Leans toward the pointer and springs back when it leaves.
 *
 * The same spring as before (stiffness 200, damping 20), now from spring.ts
 * rather than framer-motion. Nothing runs until the pointer first moves over
 * it, so the hero's buttons cost the page nothing while it loads. It stays put
 * for anyone whose device asks for reduced motion.
 */
export default function MagneticButton({
  children,
  className = "",
  onClick,
  strength = 0.3,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const spring = useRef<Spring | null>(null);

  useEffect(() => () => spring.current?.stop(), []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    spring.current ??= createSpring(
      { stiffness: 200, damping: 20 },
      [0, 0],
      ([x, y]) => {
        el.style.transform =
          x || y ? `translateX(${x}px) translateY(${y}px)` : "";
      }
    );
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    spring.current.set([
      (e.clientX - centerX) * strength,
      (e.clientY - centerY) * strength,
    ]);
  };

  const handleMouseLeave = () => {
    spring.current?.set([0, 0]);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`inline-block ${className}`}
    >
      {children}
    </div>
  );
}
