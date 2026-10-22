"use client";

import { Award, BookOpen, GraduationCap, ScrollText as ScrollIcon } from "lucide-react";
import { useRef } from "react";
import Image from "next/image";
import AnimatedSection from "./AnimatedSection";
import Reveal from "./Reveal";
import TextReveal from "./TextReveal";
import ScrollText from "./ScrollText";
import { useScrollProgress } from "./useScrollProgress";

const credentialCards = [
  { label: "M.Sc. Clinical Psychology", icon: GraduationCap },
  { label: "UGC NET-JRF", icon: ScrollIcon },
  { label: "GATE (Psychology)", icon: Award },
  { label: "Lecturer", icon: BookOpen },
];

interface AboutProps {
  about: {
    heading: string;
    paragraph: string;
    features: { icon: string; title: string; desc: string }[];
  };
}

export default function About({ about }: AboutProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const patternRef = useRef<HTMLDivElement>(null);

  // The background drifts down 15% of its height while the section crosses the
  // screen (framer-motion's offset ["start end", "end start"]).
  useScrollProgress(sectionRef, [1, 0], (progress) => {
    if (patternRef.current) {
      patternRef.current.style.transform = `translateY(${progress * 15}%)`;
    }
  });

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative bg-forest text-cream py-28 overflow-hidden"
    >
      {/* Parallax subtle pattern */}
      <div ref={patternRef} className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-20 w-80 h-80 rounded-full bg-sage/[0.06] blur-3xl" />
        <div className="absolute bottom-20 left-10 w-60 h-60 rounded-full bg-clay/[0.04] blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left */}
          <div>
            <div>
              <h2 className="font-serif text-4xl sm:text-5xl font-semibold mb-8 leading-tight">
                <TextReveal
                  text={about.heading}
                  delay={0}
                  staggerDelay={0.05}
                  className="text-cream"
                />
              </h2>
            </div>

            <ScrollText
              text={about.paragraph}
              className="font-sans text-base text-cream/80 leading-relaxed mb-12"
            />

            <div className="space-y-6">
              {about.features.map((f, i) => (
                <AnimatedSection key={f.title} delay={0.4 + i * 0.15}>
                  {/* Slides 8px right on hover, on a stiffness 300 spring. */}
                  <div className="hover-nudge flex items-start gap-4 group cursor-default">
                    <span className="text-2xl mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      {f.icon}
                    </span>
                    <div>
                      <h3 className="font-sans text-sm font-semibold text-cream tracking-wide mb-1 group-hover:text-clay transition-colors duration-300">
                        {f.title}
                      </h3>
                      <p className="font-sans text-sm text-cream/55">{f.desc}</p>
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>

          {/* Right — photo + credential cards */}
          <div>
            <AnimatedSection delay={0.15}>
              <div className="hover-grow relative w-48 h-48 mx-auto mb-8 rounded-3xl overflow-hidden border-2 border-cream/15 shadow-2xl shadow-black/30">
                <Image
                  src="/priyanka.jpeg"
                  alt="Priyanka Varma — Counselling Psychologist"
                  width={192}
                  height={192}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest/40 to-transparent" />
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <div className="grid grid-cols-2 gap-4">
              {credentialCards.map((c, i) => (
                /*
                  Tips up into place, then lifts on hover: quickly on the way
                  up (0.3s), and on the way back down with the entrance's own
                  timing, delay included — which is what framer-motion did.
                */
                <Reveal
                  key={c.label}
                  y={30}
                  rotate={-3}
                  duration={0.6}
                  delay={0.3 + i * 0.12}
                  ease="soft"
                  className="lift lift-quick bg-cream/[0.07] backdrop-blur-sm border border-cream/[0.12] rounded-2xl p-7 flex flex-col items-center justify-center text-center gap-3 cursor-default group"
                  style={{ "--lift-y": "-8px", "--lift-scale": 1.03 } as React.CSSProperties}
                >
                  <span
                    className="hover-pop text-3xl"
                    style={{ "--pop-scale": 1.2, "--pop-rotate": "10deg" } as React.CSSProperties}
                  >
                    <c.icon className="w-7 h-7 text-clay-light" aria-hidden="true" strokeWidth={1.5} />
                  </span>
                  <span className="font-serif text-base font-medium text-cream/85 group-hover:text-cream transition-colors duration-300">
                    {c.label}
                  </span>
                </Reveal>
              ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </section>
  );
}
