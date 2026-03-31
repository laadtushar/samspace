"use client";

import AnimatedSection from "./AnimatedSection";
import TiltCard from "./TiltCard";
import TextReveal from "./TextReveal";

const gradients = [
  "from-sage/20 to-transparent",
  "from-clay/15 to-transparent",
  "from-forest/10 to-transparent",
];

interface ServicesProps {
  services: {
    items: { title: string; price: string | null; unit: string | null; tags: string[] }[];
  };
}

export default function Services({ services }: ServicesProps) {
  return (
    <section id="services" className="bg-cream py-28 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-sage/[0.04] blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6">
        <AnimatedSection>
          <div className="text-center mb-20">
            <span className="font-sans text-xs font-medium tracking-[0.3em] uppercase text-clay mb-4 block">
              Services
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl font-semibold text-forest">
              <TextReveal text="How I can help" staggerDelay={0.08} />
            </h2>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8" style={{ perspective: "1000px" }}>
          {services.items.map((s, i) => (
            <AnimatedSection key={s.title} delay={i * 0.15} className="h-full">
              <TiltCard className="h-full relative">
                <div className="bg-white rounded-2xl p-8 border border-sage/15 h-full relative overflow-hidden group flex flex-col">
                  {/* Gradient accent top */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${gradients[i] || gradients[0]} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                  />

                  {/* Bottom accent line */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-clay via-clay to-sage scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

                  <div className="relative flex flex-col h-full">
                    <h3 className="font-serif text-2xl font-semibold text-forest mb-3">
                      {s.title}
                    </h3>
                    <div className="mb-6 min-h-[3.5rem] flex items-end">
                      {s.price ? (
                        <div>
                          <span className="font-serif text-4xl font-bold text-clay">
                            {s.price}
                          </span>
                          <span className="font-sans text-sm text-forest/50">
                            {s.unit}
                          </span>
                        </div>
                      ) : (
                        <span className="font-sans text-sm text-forest/45 italic">
                          Details below
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-4 mt-auto">
                      {s.tags.map((tag) => (
                        <span
                          key={tag}
                          className="font-sans text-xs bg-forest/[0.05] text-forest/65 rounded-full px-4 py-2 font-medium border border-forest/[0.06] hover:bg-forest/[0.1] hover:text-forest/80 transition-all duration-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </TiltCard>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
