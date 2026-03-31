"use client";

import Marquee from "./Marquee";

interface MarqueeDividerProps {
  text1: string;
  text2: string;
  className?: string;
}

export default function MarqueeDivider({
  text1,
  text2,
  className = "bg-cream",
}: MarqueeDividerProps) {
  return (
    <div className={`${className} overflow-hidden py-4 border-y border-forest/[0.05]`}>
      <Marquee baseVelocity={-1.5} className="text-forest">
        {text1}
      </Marquee>
      <Marquee baseVelocity={1.5} className="text-forest">
        {text2}
      </Marquee>
    </div>
  );
}
