"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import ConvertedText from "./ConvertedText";
import TextReveal from "./TextReveal";

interface FaqProps {
  faq: {
    heading: string;
    intro: string;
    items: { question: string; answer: string }[];
  };
  /**
   * The rollout switch, decided on the server.
   *
   * The sliding-scale answer quotes the same figures the services card does.
   * Before this, that card converted and this answer did not, so a visitor
   * abroad read two currencies on one page.
   */
  localCurrency?: boolean;
}

export default function Faq({ faq, localCurrency = false }: FaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-white py-28 relative overflow-hidden">
      {/* Animated background orb — a CSS loop (.drift) */}
      <div
        className="drift absolute top-1/3 right-0 w-[450px] h-[450px] rounded-full bg-clay/[0.04] blur-3xl pointer-events-none"
        style={
          { "--drift-x": "-35px", "--drift-y": "25px", "--drift-duration": "22s" } as React.CSSProperties
        }
      />

      <div className="relative max-w-3xl mx-auto px-6">
        <AnimatedSection>
          <div className="text-center mb-14">
            <span className="font-sans text-xs font-medium tracking-[0.3em] uppercase text-clay mb-4 block">
              Frequently Asked
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl font-semibold text-forest mb-5 leading-tight">
              <TextReveal text={faq.heading} staggerDelay={0.05} />
            </h2>
            <p className="font-sans text-base text-forest/55 max-w-2xl mx-auto leading-relaxed">
              <ConvertedText text={faq.intro} enabled={localCurrency} />
            </p>
          </div>
        </AnimatedSection>

        <div className="space-y-3">
          {faq.items.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <AnimatedSection key={item.question} delay={0.05 + i * 0.06}>
                <div className="bg-cream border border-sage/20 rounded-2xl overflow-hidden transition-colors duration-300 hover:border-clay/40">
                  <h3>
                    <button
                      type="button"
                      id={`faq-question-${i}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${i}`}
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                      className="w-full flex items-start justify-between gap-4 text-left px-6 py-5 font-serif text-lg font-semibold text-forest hover:text-clay transition-colors duration-200"
                    >
                      {/* Also admin-editable, and a question can name a rate
                          just as readily as the answer below it. */}
                      <ConvertedText text={item.question} enabled={localCurrency} />
                      <span
                        className={`faq-chevron flex-shrink-0 mt-1 ${isOpen ? "is-open" : ""}`}
                      >
                        <ChevronDown className="w-5 h-5 text-clay" />
                      </span>
                    </button>
                  </h3>

                  {/* The answer stays mounted whether or not it is expanded, so
                      crawlers always see the text the FAQ schema promises.

                      It opens to its natural height in CSS (.faq-answer): a
                      one-row grid whose row grows from 0fr to 1fr, which the
                      browser animates the way framer-motion animated
                      height: "auto" — same 0.35s, same curve, with the fade. */}
                  <div
                    id={`faq-answer-${i}`}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                    className={`faq-answer ${isOpen ? "is-open" : ""}`}
                  >
                    <div className="overflow-hidden">
                      <p className="font-sans text-sm text-forest/65 leading-relaxed px-6 pb-5">
                        <ConvertedText text={item.answer} enabled={localCurrency} />
                      </p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
