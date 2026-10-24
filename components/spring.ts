/**
 * A small spring, for the few effects that follow the pointer or the scroll.
 *
 * These used to be framer-motion's useSpring. The physics is the same — a mass
 * of 1 pulled toward a target by `stiffness` and slowed by `damping` — so the
 * magnetic buttons, the card tilt and the progress bar settle with the same
 * overshoot and the same timing as before. When the target moves mid-flight the
 * spring carries on from where it is, at the speed it is going, which is what
 * makes a pointer-following effect feel like it has weight.
 *
 * It costs nothing until the first `set`, runs one requestAnimationFrame loop
 * while it is moving, and stops itself once it is at rest. Several values that
 * move together (x and y) share one spring and one loop.
 */
export interface Spring {
  /** Move the target; the spring starts (or keeps) moving toward it. */
  set(target: number[]): void;
  /** Stop the loop, e.g. on unmount. */
  stop(): void;
}

export function createSpring(
  {
    stiffness,
    damping,
    restDelta = 0.01,
    restSpeed = 0.1,
  }: { stiffness: number; damping: number; restDelta?: number; restSpeed?: number },
  initial: number[],
  onFrame: (values: number[]) => void
): Spring {
  const value = [...initial];
  const velocity = initial.map(() => 0);
  let target = [...initial];
  let raf = 0;
  let last = 0;

  const step = (now: number) => {
    // A long gap (a background tab) is not a reason to fling the value.
    let remaining = Math.min((now - last) / 1000, 0.064);
    last = now;
    // Fixed 1ms substeps keep the integration stable at every frame rate.
    while (remaining > 0) {
      const h = Math.min(remaining, 0.001);
      for (let i = 0; i < value.length; i++) {
        const accel = -stiffness * (value[i] - target[i]) - damping * velocity[i];
        velocity[i] += accel * h;
        value[i] += velocity[i] * h;
      }
      remaining -= h;
    }
    const resting = value.every(
      (v, i) => Math.abs(target[i] - v) < restDelta && Math.abs(velocity[i]) < restSpeed
    );
    if (resting) {
      for (let i = 0; i < value.length; i++) {
        value[i] = target[i];
        velocity[i] = 0;
      }
      raf = 0;
    } else {
      raf = requestAnimationFrame(step);
    }
    onFrame(value);
  };

  return {
    set(next) {
      target = next;
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

/** Whether the visitor's device asks for less motion. */
export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
