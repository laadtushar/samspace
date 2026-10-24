import type { CSSProperties, HTMLAttributes } from "react";

/**
 * An element that rises (or slides, or tips) into place the first time it
 * scrolls into view — the CSS replacement for framer-motion's
 * `initial` + `whileInView`.
 *
 * It renders plain, fully visible markup; RevealObserver decides when the
 * entrance plays, and the `.reveal` rules in motion.css play it. Each option
 * maps to the framer-motion value it replaces, so a call site reads the same
 * as the motion component it was: `y: 30` is `initial={{ y: 30 }}`, `duration`
 * and `delay` are in seconds.
 *
 * Only opacity, transform and filter move, so a reveal never shifts layout.
 *
 * The starting offsets are classes (.reveal-y-40, .reveal-x-n15 for -15, …),
 * and the timing is plain inline animation-* properties. An earlier version
 * wrote everything as inline custom properties, and measured: on this page
 * those made the browser's first style pass, the one in front of the first
 * paint, take nearly twice as long. An offset with no class in motion.css
 * falls back to an inline custom property, so it still works.
 */

export const EASE = {
  /** framer-motion's "easeOut" — the same curve as CSS ease-out. */
  out: "ease-out",
  /** The site's soft deceleration, [0.23, 0.86, 0.39, 0.96]. */
  soft: "cubic-bezier(0.23, 0.86, 0.39, 0.96)",
  /**
   * A stiffness 100 spring (framer-motion's damping default of 10), sampled
   * into a CSS linear() curve. A spring has no duration of its own — it takes
   * as long as it takes to settle — so this one sets it: 1.269s.
   */
  spring100: "var(--spring-100-10)",
} as const;

export interface RevealOptions {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  rotateX?: number;
  rotateY?: number;
  /** Start blurred by this many pixels. */
  blur?: number;
  duration?: number;
  delay?: number;
  ease?: keyof typeof EASE;
  /** useInView's `margin`: negative waits until the element is further in. */
  margin?: string;
  /**
   * A .lift card: its hover lift moves on the entrance's own timing, delay
   * included, as framer-motion's whileHover did.
   */
  lift?: boolean;
}

/** Offsets that have a class in motion.css; anything else goes inline. */
const OFFSET_CLASSES: Record<string, number[]> = {
  x: [30, 16, -15, -50],
  y: [40, 30, 10],
  scale: [0.9, 0.95],
  rotate: [-3],
  "rotate-x": [10],
  "rotate-y": [-15],
  blur: [6],
};
const UNITS: Record<string, string> = {
  x: "px", y: "px", scale: "", rotate: "deg", "rotate-x": "deg", "rotate-y": "deg", blur: "px",
};

/** The props that make any element a reveal; for elements Reveal can't be. */
export function revealProps(
  { x, y, scale, rotate, rotateX, rotateY, blur, duration, delay, ease, margin, lift }: RevealOptions,
  className = "",
  style?: CSSProperties
) {
  const classes = ["reveal"];
  const inline: Record<string, string | number> = {};
  const offsets: [string, number | undefined][] = [
    ["x", x], ["y", y], ["scale", scale], ["rotate", rotate],
    ["rotate-x", rotateX], ["rotate-y", rotateY], ["blur", blur],
  ];
  for (const [name, value] of offsets) {
    if (!value || (name === "scale" && value === 1)) continue;
    if (OFFSET_CLASSES[name].includes(value)) {
      const token = name === "scale" ? Math.round(value * 100) : value < 0 ? `n${-value}` : value;
      classes.push(`reveal-${name}-${token}`);
    } else {
      inline[`--reveal-${name}`] = `${value}${UNITS[name]}`;
    }
  }
  if (blur) classes.push("reveal-blur");

  const seconds = ease === "spring100" ? 1.269 : duration;
  const timing: CSSProperties = {};
  if (seconds !== undefined) timing.animationDuration = `${seconds}s`;
  if (ease) timing.animationTimingFunction = EASE[ease];
  if (delay) timing.animationDelay = `${+delay.toFixed(3)}s`;
  if (lift) {
    timing.transitionDuration = timing.animationDuration;
    timing.transitionTimingFunction = timing.animationTimingFunction;
    timing.transitionDelay = timing.animationDelay;
  }

  return {
    className: `${classes.join(" ")} ${className}`.trim(),
    style: { ...inline, ...timing, ...style } as CSSProperties,
    ...(margin ? { "data-reveal-margin": margin } : {}),
  };
}

type RevealProps = RevealOptions &
  HTMLAttributes<HTMLElement> & {
    as?: "div" | "li" | "p" | "span";
  };

export default function Reveal({
  as: Tag = "div",
  x,
  y,
  scale,
  rotate,
  rotateX,
  rotateY,
  blur,
  duration,
  delay,
  ease,
  margin,
  lift,
  className,
  style,
  ...rest
}: RevealProps) {
  return (
    <Tag
      {...rest}
      {...revealProps(
        { x, y, scale, rotate, rotateX, rotateY, blur, duration, delay, ease, margin, lift },
        className,
        style
      )}
    />
  );
}
