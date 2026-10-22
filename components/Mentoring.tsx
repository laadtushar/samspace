import { BookOpen, GraduationCap, TriangleAlert } from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import Reveal from "./Reveal";
import TiltCard from "./TiltCard";
import TextReveal from "./TextReveal";

interface MentoringProps {
  mentoring: {
    heading: string;
    subtext: string;
    card1Title: string;
    card1Items: string[];
    card2Title: string;
    card2Items: string[];
  };
}

export default function Mentoring({ mentoring }: MentoringProps) {
  return (
    <section
      id="mentoring"
      className="bg-gradient-to-b from-cream via-white to-cream py-28 relative overflow-hidden"
    >
      {/* Decorative floating shapes — CSS loops (.drift in globals.css) */}
      <div
        className="drift absolute top-20 right-10 w-40 h-40 rounded-full bg-sage/[0.06] blur-2xl pointer-events-none"
        style={
          { "--drift-y": "-20px", "--drift-rotate": "5deg", "--drift-duration": "15s" } as React.CSSProperties
        }
      />
      <div
        className="drift absolute bottom-20 left-10 w-32 h-32 rounded-full bg-clay/[0.05] blur-2xl pointer-events-none"
        style={
          { "--drift-y": "15px", "--drift-rotate": "-3deg", "--drift-duration": "12s" } as React.CSSProperties
        }
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <AnimatedSection>
          <div className="text-center mb-6">
            <span className="font-sans text-xs font-medium tracking-[0.3em] uppercase text-clay mb-4 block">
              Academic Mentoring
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl font-semibold text-forest mb-5">
              <TextReveal text={mentoring.heading} staggerDelay={0.06} />
            </h2>
            <p className="font-sans text-base text-forest/55 max-w-2xl mx-auto leading-relaxed mb-4">
              {mentoring.subtext}
            </p>
            <Reveal
              as="p"
              duration={0.6}
              delay={0.4}
              ease="out"
              className="font-sans text-sm text-forest/45 italic max-w-xl mx-auto"
            >
              <TriangleAlert className="inline w-4 h-4 -mt-0.5 mr-1 not-italic" aria-hidden="true" strokeWidth={1.5} />
              These sessions are not psychotherapy and do not involve clinical
              diagnosis or treatment.
            </Reveal>
          </div>
        </AnimatedSection>

        <div
          className="grid md:grid-cols-2 gap-8 mt-14"
          style={{ perspective: "1000px" }}
        >
          {/* Card 1 */}
          <AnimatedSection delay={0.1} className="h-full">
            <TiltCard className="h-full">
              <div className="bg-white rounded-2xl p-8 border border-sage/15 h-full group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-sage/[0.06] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-sage/[0.12] transition-all duration-700" />
                <div className="relative">
                  {/* A quick shake of the icon on hover (.hover-wiggle) */}
                  <div className="hover-wiggle mb-5 inline-block">
                    <BookOpen className="w-9 h-9 text-forest/70" aria-hidden="true" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-serif text-2xl font-semibold text-forest mb-6">
                    {mentoring.card1Title}
                  </h3>
                  <ul className="space-y-3.5">
                    {mentoring.card1Items.map((item, i) => (
                      <Reveal
                        as="li"
                        key={item}
                        x={-15}
                        duration={0.4}
                        delay={0.2 + i * 0.08}
                        ease="out"
                        className="flex items-start gap-3 group/item"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-clay mt-2 flex-shrink-0 group-hover/item:scale-150 transition-transform duration-200" />
                        <span className="font-sans text-sm text-forest/65 leading-relaxed group-hover/item:text-forest/85 transition-colors duration-200">
                          {item}
                        </span>
                      </Reveal>
                    ))}
                  </ul>
                </div>
              </div>
            </TiltCard>
          </AnimatedSection>

          {/* Card 2 */}
          <AnimatedSection delay={0.25} className="h-full">
            <TiltCard className="h-full">
              <div className="bg-white rounded-2xl p-8 border border-sage/15 h-full group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-clay/[0.05] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-clay/[0.1] transition-all duration-700" />
                <div className="relative">
                  <div className="hover-wiggle mb-5 inline-block">
                    <GraduationCap className="w-9 h-9 text-forest/70" aria-hidden="true" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-serif text-2xl font-semibold text-forest mb-6">
                    {mentoring.card2Title}
                  </h3>
                  <ul className="space-y-3.5">
                    {mentoring.card2Items.map((item, i) => (
                      <Reveal
                        as="li"
                        key={item}
                        x={-15}
                        duration={0.4}
                        delay={0.35 + i * 0.08}
                        ease="out"
                        className="flex items-start gap-3 group/item"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-clay mt-2 flex-shrink-0 group-hover/item:scale-150 transition-transform duration-200" />
                        <span className="font-sans text-sm text-forest/65 leading-relaxed group-hover/item:text-forest/85 transition-colors duration-200">
                          {item}
                        </span>
                      </Reveal>
                    ))}
                  </ul>
                </div>
              </div>
            </TiltCard>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
