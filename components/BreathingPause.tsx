"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * One minute of paced breathing, offered rather than imposed.
 *
 * Nothing moves until the visitor presses start: a page read by anxious people
 * should not begin animating at them. The circle grows on the in-breath and
 * shrinks on the longer out-breath; the words say the same thing, so it still
 * works for anyone whose device asks for reduced motion — framer-motion drops
 * the scaling for them (MotionPreferences) and the label carries it alone.
 */

const INHALE_SECONDS = 4;
const EXHALE_SECONDS = 6;
const CYCLES = 6; // six ten-second breaths: one minute

type Phase = "idle" | "in" | "out" | "done";

export default function BreathingPause() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (phase !== "in" && phase !== "out") return;
    const seconds = phase === "in" ? INHALE_SECONDS : EXHALE_SECONDS;
    const timer = setTimeout(() => {
      if (phase === "in") return setPhase("out");
      if (cycle + 1 >= CYCLES) return setPhase("done");
      setCycle((c) => c + 1);
      setPhase("in");
    }, seconds * 1000);
    return () => clearTimeout(timer);
  }, [phase, cycle]);

  const running = phase === "in" || phase === "out";
  const start = () => {
    setCycle(0);
    setPhase("in");
  };

  const label =
    phase === "in"
      ? "Breathe in"
      : phase === "out"
        ? "Breathe out"
        : phase === "done"
          ? "That was a minute. Welcome back."
          : "Take one minute";

  return (
    <section id="breathe" className="bg-cream py-24 px-6">
      <div className="max-w-xl mx-auto text-center">
        <p className="font-sans text-xs text-clay uppercase tracking-[0.2em] mb-4">
          Before anything else
        </p>
        <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-forest mb-10">
          Slow down for one minute
        </h2>

        <div className="relative mx-auto mb-10 flex items-center justify-center w-56 h-56">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-sage/25"
            animate={{ scale: phase === "in" ? 1 : 0.55 }}
            initial={{ scale: 0.55 }}
            transition={{
              duration: phase === "in" ? INHALE_SECONDS : EXHALE_SECONDS,
              ease: "easeInOut",
            }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute rounded-full bg-forest/80 w-28 h-28"
            animate={{ scale: phase === "in" ? 1.35 : 0.85 }}
            initial={{ scale: 0.85 }}
            transition={{
              duration: phase === "in" ? INHALE_SECONDS : EXHALE_SECONDS,
              ease: "easeInOut",
            }}
          />
          <p
            className="relative font-serif text-base text-cream px-2"
            aria-live="polite"
          >
            {running ? label : phase === "done" ? "✓" : "Ready"}
          </p>
        </div>

        <p className="font-sans text-sm text-forest/60 mb-6 min-h-[1.5rem]">
          {running
            ? `Breath ${cycle + 1} of ${CYCLES} · in for ${INHALE_SECONDS}, out for ${EXHALE_SECONDS}`
            : label}
        </p>

        <button
          type="button"
          onClick={running ? () => setPhase("idle") : start}
          className="font-sans text-sm rounded-full px-6 py-3 border border-forest/20 text-forest hover:border-clay hover:text-clay transition-colors"
        >
          {running ? "Stop" : phase === "done" ? "Once more" : "Start"}
        </button>
      </div>
    </section>
  );
}
