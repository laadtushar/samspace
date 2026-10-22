"use client";

import { useEffect, useRef } from "react";
import { createSpring, type Spring } from "./spring";

interface MarqueeProps {
  children: string;
  baseVelocity?: number;
  className?: string;
}

/*
  The marquee's drift is a CSS animation (.marquee-track in globals.css), so it
  runs on the compositor from the first paint with no JavaScript at all. The
  framer-motion version moved it from a requestAnimationFrame callback on the
  main thread, every frame, for as long as the page was open — four of them.

  What JavaScript still adds is the part a keyframe can't know: scrolling
  speeds the strips up, and scrolling back up reverses them. That used to be
  useVelocity(scrollY) through a spring (stiffness 400, damping 50) into a
  factor of 2 per 1000px/s. Here the same chain sets each animation's
  playbackRate instead of its position — one shared loop that runs only while
  the page is scrolling or settling, and only touches strips that are on
  screen.

  The geometry is the framer-motion version's: the track slides between -20%
  and -45% of its width, starting at -25%, at |baseVelocity| percent a second.
*/

const LOOP_PERCENT = 25;
/** framer-motion's velocity window: older than this and scrolling has stopped. */
const MAX_VELOCITY_DELTA = 30;

/** null: not on screen yet; false: nothing to steer. */
const tracks = new Map<HTMLElement, Animation | null | false>();
const visible = new Set<Animation>();
let observer: IntersectionObserver | null = null;
let smoothVelocity: Spring | null = null;
let rate = 1;
let direction = 1;
let velocity = 0;
let lastY = 0;
let lastChange = 0;
let frame = 0;

function applyRate(animation: Animation) {
  if (animation.playbackRate === rate) return;
  if (animation.updatePlaybackRate) animation.updatePlaybackRate(rate);
  else animation.playbackRate = rate;
}

function tick(now: number) {
  frame = 0;
  const y = window.scrollY;
  if (!lastChange) {
    // The first frame only takes a reading: the position from before the
    // strips came on screen would read as one enormous jump. Frame times
    // throughout, as framer-motion used, so no interval is a sliver.
    lastY = y;
    lastChange = now;
  } else if (y !== lastY) {
    // As framer-motion measured it: the change since the last frame, over the
    // time since the last change, that time capped at 30ms.
    velocity = ((y - lastY) / Math.min(now - lastChange, MAX_VELOCITY_DELTA)) * 1000;
    lastY = y;
    lastChange = now;
  } else if (now - lastChange > MAX_VELOCITY_DELTA) {
    velocity = 0;
  }
  smoothVelocity?.set([velocity]);
  // Keep sampling until scrolling has been quiet for a few frames.
  if (now - lastChange <= MAX_VELOCITY_DELTA * 4) {
    frame = requestAnimationFrame(tick);
  } else {
    lastChange = 0;
  }
}

function onScroll() {
  if (frame || visible.size === 0) return;
  frame = requestAnimationFrame(tick);
}

/*
  A strip's animation is looked up the first time it comes on screen, not when
  the page hydrates: getAnimations() makes the browser bring style up to date
  on the spot, and during hydration that is a full pass the page would wait on.
  In an observer callback the work is already done.
*/
function prepare(el: HTMLElement) {
  // No animation means reduced motion (or none supported): nothing to steer.
  const animation = el.getAnimations()[0];
  if (!animation) return false;
  // Playing backwards stops at time zero, so start a long way into the loop.
  // Whole loops only, so nothing visibly moves.
  const loop = Number(animation.effect?.getComputedTiming().duration) || 0;
  if (loop > 0) {
    animation.currentTime = Number(animation.currentTime ?? 0) + loop * 100_000;
  }
  return animation;
}

function register(el: HTMLElement) {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        let anim = tracks.get(el);
        if (anim === null && entry.isIntersecting) {
          anim = prepare(el);
          tracks.set(el, anim);
        }
        if (!anim) continue;
        if (entry.isIntersecting) {
          visible.add(anim);
          applyRate(anim);
        } else {
          visible.delete(anim);
        }
      }
    });
    smoothVelocity = createSpring(
      { stiffness: 400, damping: 50, restDelta: 0.5, restSpeed: 2 },
      [0],
      ([v]) => {
        const factor = v / 500;
        if (factor < 0) direction = -1;
        else if (factor > 0) direction = 1;
        rate = direction * (1 + Math.abs(factor));
        visible.forEach(applyRate);
      }
    );
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  tracks.set(el, null);
  observer.observe(el);
  return () => {
    const anim = tracks.get(el);
    if (anim) visible.delete(anim);
    tracks.delete(el);
    observer?.unobserve(el);
  };
}

export default function Marquee({
  children,
  baseVelocity = -2,
  className = "",
}: MarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trackRef.current) return register(trackRef.current);
  }, []);

  const seconds = LOOP_PERCENT / Math.abs(baseVelocity);
  // The loop runs -20% → -45%; -25% is a fifth of the way along it (four
  // fifths, counted from the other end, when it runs in reverse).
  const startAt = baseVelocity < 0 ? 0.2 : 0.8;

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden whitespace-nowrap flex flex-nowrap py-6"
    >
      <div
        ref={trackRef}
        className="marquee-track flex whitespace-nowrap gap-12 flex-nowrap"
        style={{
          animationDuration: `${seconds}s`,
          animationDelay: `${-startAt * seconds}s`,
          animationDirection: baseVelocity < 0 ? "normal" : "reverse",
        }}
      >
        {[...Array(4)].map((_, i) => (
          <span
            key={i}
            className={`block text-[5vw] sm:text-[3.5vw] font-serif font-semibold tracking-tight opacity-[0.08] ${className}`}
          >
            {children}
          </span>
        ))}
      </div>
    </div>
  );
}
