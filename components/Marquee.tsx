"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  useMotionValue,
  useAnimationFrame,
} from "framer-motion";
import { wrap } from "@motionone/utils";

interface MarqueeProps {
  children: string;
  baseVelocity?: number;
  className?: string;
}

export default function Marquee({
  children,
  baseVelocity = -2,
  className = "",
}: MarqueeProps) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400,
  });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 2], {
    clamp: false,
  });

  const x = useTransform(baseX, (v) => `${wrap(-20, -45, v)}%`);
  const directionFactor = useRef(1);

  useAnimationFrame((_, delta) => {
    let moveBy = directionFactor.current * baseVelocity * (delta / 1000);

    if (velocityFactor.get() < 0) {
      directionFactor.current = -1;
    } else if (velocityFactor.get() > 0) {
      directionFactor.current = 1;
    }

    moveBy += directionFactor.current * moveBy * velocityFactor.get();
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden whitespace-nowrap flex flex-nowrap py-6"
    >
      <motion.div
        className="flex whitespace-nowrap gap-12 flex-nowrap"
        style={{ x }}
      >
        {[...Array(4)].map((_, i) => (
          <span
            key={i}
            className={`block text-[5vw] sm:text-[3.5vw] font-serif font-semibold tracking-tight opacity-[0.08] ${className}`}
          >
            {children}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
