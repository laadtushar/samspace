import type { CSSProperties, HTMLAttributes } from "react";

/**
 * An element that rises (or slides, or tips) into place the first time it
 * scrolls into view — the CSS replacement for framer-motion's
 * `initial` + `whileInView`.
 *
 * It renders plain, fully visible markup with the entrance described in CSS
 * custom properties; RevealObserver decides when it plays, and the `.reveal`
 * rules in globals.css play it. Each option maps to the framer-motion value it
 * replaces, so a call site reads the same as the motion component it was:
 * `y: 30` is `initial={{ y: 30 }}`, `duration` and `delay` are in seconds.
 *
 * Only opacity, transform and filter move, so a reveal never shifts layout.
 */

export const EASE = {
  /** framer-motion's "easeOut" — the same curve as CSS ease-out. */
  out: "ease-out",
  /** The site's soft deceleration, [0.23, 0.86, 0.39, 0.96]. */
  soft: "var(--ease-soft)",
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
}

/** The props that make any element a reveal; for elements Reveal can't be. */
export function revealProps(
  {
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
  }: RevealOptions,
  className = "",
  style?: CSSProperties
) {
  const vars: Record<string, string | number> = {};
  if (x) vars["--reveal-x"] = `${x}px`;
  if (y) vars["--reveal-y"] = `${y}px`;
  if (scale !== undefined) vars["--reveal-scale"] = scale;
  if (rotate) vars["--reveal-rotate"] = `${rotate}deg`;
  if (rotateX) vars["--reveal-rotate-x"] = `${rotateX}deg`;
  if (rotateY) vars["--reveal-rotate-y"] = `${rotateY}deg`;
  if (blur) vars["--reveal-blur"] = `${blur}px`;
  const seconds = ease === "spring100" ? 1.269 : duration;
  if (seconds !== undefined) vars["--reveal-duration"] = `${seconds}s`;
  if (delay) vars["--reveal-delay"] = `${delay}s`;
  if (ease) vars["--reveal-ease"] = EASE[ease];
  return {
    className: `reveal${blur ? " reveal-blur" : ""} ${className}`.trim(),
    style: { ...vars, ...style } as CSSProperties,
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
  className,
  style,
  ...rest
}: RevealProps) {
  return (
    <Tag
      {...rest}
      {...revealProps(
        { x, y, scale, rotate, rotateX, rotateY, blur, duration, delay, ease, margin },
        className,
        style
      )}
    />
  );
}
