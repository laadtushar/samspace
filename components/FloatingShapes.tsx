import { cn } from "@/lib/utils";

/*
  The hero's drifting bands. CSS now (.floating-shape in globals.css), like the
  rest of the hero: each band drops 150px and turns 15° into place over 2.4s
  while it fades in over 1.2s, then bobs on a 12s loop — framer-motion's exact
  values, starting from the first paint instead of after hydration. They are
  decoration (no text or image), so starting at opacity 0 has no bearing on
  the Largest Contentful Paint. With reduced motion they only fade in.
*/

interface ShapeProps {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
}

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-sage/[0.12]",
}: ShapeProps) {
  return (
    <div
      className={cn("absolute floating-shape", className)}
      style={
        {
          "--shape-delay": `${delay}s`,
          "--shape-rotate": `${rotate}deg`,
        } as React.CSSProperties
      }
    >
      <div style={{ width, height }} className="relative floating-shape-bob">
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            `bg-gradient-to-r ${gradient} to-transparent`,
            "backdrop-blur-[2px] border border-cream/[0.08]"
          )}
          style={{ transform: `rotate(${rotate}deg)` }}
        />
      </div>
    </div>
  );
}

export default function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <ElegantShape
        delay={0.3}
        width={600}
        height={140}
        rotate={12}
        gradient="from-sage/[0.15]"
        className="top-[-10%] left-[-5%]"
      />
      <ElegantShape
        delay={0.5}
        width={500}
        height={120}
        rotate={-15}
        gradient="from-clay/[0.12]"
        className="top-[15%] right-[-8%]"
      />
      <ElegantShape
        delay={0.4}
        width={300}
        height={80}
        rotate={-8}
        gradient="from-forest/[0.08]"
        className="bottom-[15%] left-[5%]"
      />
      <ElegantShape
        delay={0.6}
        width={200}
        height={60}
        rotate={20}
        gradient="from-clay/[0.08]"
        className="top-[60%] right-[10%]"
      />
      <ElegantShape
        delay={0.7}
        width={150}
        height={40}
        rotate={-25}
        gradient="from-sage/[0.1]"
        className="bottom-[5%] right-[20%]"
      />
    </div>
  );
}
