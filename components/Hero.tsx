"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import FloatingShapes from "./FloatingShapes";
import TextReveal from "./TextReveal";
import MagneticButton from "./MagneticButton";

const credentials = [
  "M.Sc. Clinical Psychology",
  "UGC NET-JRF Qualified",
  "GATE (Psychology) Qualified",
];

interface HeroProps {
  hero: { headline: string; subtext: string; quoteText: string };
  onBookSession?: () => void;
}

export default function Hero({ hero, onBookSession }: HeroProps) {
  const handleScroll = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      /*
        min-h-[100svh] rather than 100vh: on a phone, 100vh is measured against
        the viewport with the browser's address bar hidden, so the section is
        taller than what is actually on screen and pushes the heading down. svh
        is the small viewport — what the reader can really see. min-h-screen
        stays as the fallback for anything that does not know svh.
      */
      className="relative min-h-screen min-h-[100svh] flex items-center bg-cream overflow-hidden pt-16"
    >
      {/* Animated floating shapes */}
      <FloatingShapes />

      {/* Grain texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/*
        Lighter vertical padding on a phone. The section already centres its
        contents inside a full-height box and clears the fixed header with
        pt-16; another 80px on top of that left the heading sitting a long way
        down an otherwise empty screen.
      */}
      <div className="relative max-w-6xl mx-auto px-6 py-8 sm:py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left column */}
          <div>
            {/* Tag — cinematic fade in */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <span className="inline-block font-sans text-xs font-medium tracking-widest uppercase text-clay border border-clay/40 rounded-full px-4 py-1.5 mb-8">
                Counselling Psychologist & Academic Mentor
              </span>
            </motion.div>

            {/* Headline — word-by-word blur reveal */}
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-[4.5rem] font-semibold text-forest leading-[1.1] mb-6">
              <TextReveal
                text={hero.headline}
                delay={1.0}
                staggerDelay={0.06}
              />
            </h1>

            {/* Subtext — character blur */}
            <motion.p
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 1.8 }}
              className="font-sans text-lg text-forest/60 leading-relaxed mb-8 max-w-lg"
            >
              {hero.subtext}
            </motion.p>

            {/* Credential pills — staggered pop */}
            <div className="flex flex-wrap gap-2 mb-10">
              {credentials.map((c, i) => (
                <motion.span
                  key={c}
                  initial={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  transition={{
                    duration: 0.5,
                    delay: 2.1 + i * 0.12,
                    ease: [0.23, 0.86, 0.39, 0.96],
                  }}
                  className="font-sans text-xs bg-forest/8 text-forest/80 border border-forest/15 rounded-full px-4 py-1.5 font-medium"
                >
                  {c}
                </motion.span>
              ))}
            </div>

            {/* CTAs — magnetic hover */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 2.5 }}
              className="flex flex-wrap gap-4"
            >
              <MagneticButton strength={0.15}>
                <button
                  onClick={() => onBookSession?.()}
                  className="font-sans text-sm font-medium bg-forest text-cream px-7 py-3.5 rounded-full hover:bg-forest-deep active:scale-[0.97] transition-all duration-300 shadow-xl shadow-forest/20"
                >
                  Book a Session
                </button>
              </MagneticButton>
              <MagneticButton strength={0.15}>
                <button
                  onClick={() => handleScroll("#services")}
                  className="font-sans text-sm font-medium border-2 border-clay text-clay px-7 py-3.5 rounded-full hover:bg-clay hover:text-cream active:scale-[0.97] transition-all duration-300"
                >
                  Explore Services
                </button>
              </MagneticButton>
            </motion.div>
          </div>

          {/* Right column — floating cards */}
          <div className="relative flex flex-col items-center gap-5 lg:items-end">
            {/* Main quote card — drops in with bounce */}
            <motion.div
              initial={{ opacity: 0, y: -60, rotate: -6 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{
                duration: 1.2,
                delay: 1.2,
                ease: [0.23, 0.86, 0.39, 0.96],
              }}
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="bg-forest text-cream rounded-3xl p-8 max-w-sm shadow-2xl shadow-forest/30 relative overflow-hidden"
              >
                {/* Subtle inner glow */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-sage/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />

                <div className="relative">
                  <div className="font-serif text-5xl text-sage/50 leading-none mb-4">
                    &ldquo;
                  </div>
                  <p className="font-serif text-xl leading-relaxed text-cream/90 mb-6">
                    {hero.quoteText}
                  </p>
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="w-11 h-11 rounded-full overflow-hidden border-2 border-sage/40 flex-shrink-0"
                    >
                      <Image
                        src="/priyanka.jpeg"
                        alt="Priyanka Varma"
                        width={44}
                        height={44}
                        className="w-full h-full object-cover"
                      />
                    </motion.div>
                    <div>
                      <p className="font-sans text-sm font-medium text-cream">
                        Priyanka Varma
                      </p>
                      <p className="font-sans text-xs text-cream/50">
                        Counselling Psychologist
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Floating badges — pop in */}
            <div className="flex flex-wrap gap-3 justify-center lg:justify-end">
              {[
                { emoji: "🔒", text: "Confidential & Ethical" },
                { emoji: "🕐", text: "45–50 min · Online Sessions" },
              ].map((badge, i) => (
                <motion.div
                  key={badge.text}
                  initial={{ opacity: 0, scale: 0, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{
                    duration: 0.6,
                    delay: 2.0 + i * 0.15,
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                  }}
                  className="bg-white border border-sage/25 rounded-2xl px-5 py-3 shadow-lg shadow-forest/5 flex items-center gap-2"
                >
                  <span className="text-base">{badge.emoji}</span>
                  <span className="font-sans text-xs font-medium text-forest/80">
                    {badge.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
