"use client";

import { useEffect, useRef } from "react";
import { createSpring, prefersReducedMotion, type Spring } from "./spring";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
}

/** Tilt at the card's edges, in degrees. */
const MAX_TILT = 8;

/**
 * A card that tips toward the pointer.
 *
 * The tilt follows the same spring as before (stiffness 150, damping 20), from
 * spring.ts rather than framer-motion, and is written straight to the card's
 * transform — no re-render per frame. The 1.02 lift and the clay ring are CSS
 * (.tilt-card in globals.css): the lift only for a real hover, as framer-motion's
 * whileHover was, and the ring fading in and vanishing on leave as before.
 *
 * Nothing runs until the pointer first moves over a card. For anyone whose
 * device asks for reduced motion the card no longer tips; the lift is instant.
 */
export default function TiltCard({ children, className = "" }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const spring = useRef<Spring | null>(null);

  useEffect(() => () => spring.current?.stop(), []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    spring.current ??= createSpring(
      { stiffness: 150, damping: 20, restDelta: 0.001, restSpeed: 0.01 },
      [0, 0],
      ([x, y]) => {
        // framer-motion's useTransform clamped to its output range; so does this.
        const clamp = (v: number) => Math.max(-MAX_TILT, Math.min(MAX_TILT, v));
        const rotateX = clamp(-y * 2 * MAX_TILT);
        const rotateY = clamp(x * 2 * MAX_TILT);
        el.style.transform =
          rotateX || rotateY ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg)` : "";
      }
    );
    const rect = e.currentTarget.getBoundingClientRect();
    spring.current.set([
      (e.clientX - rect.left) / rect.width - 0.5,
      (e.clientY - rect.top) / rect.height - 0.5,
    ]);
  };

  return (
    <div
      ref={ref}
      className={`tilt-card cursor-pointer ${className}`}
      style={{ transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => spring.current?.set([0, 0])}
    >
      <div style={{ transform: "translateZ(30px)" }}>{children}</div>
      <div
        aria-hidden="true"
        className="tilt-card-ring absolute inset-0 rounded-2xl border-2 border-clay/30 pointer-events-none"
      />
    </div>
  );
}
