"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import TextReveal from "./TextReveal";

interface FaqProps {
  faq: {
    heading: string;
    intro: string;
    items: { question: string; answer: string }[];
  };
}

export default function Faq({ faq }: FaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-white py-28 relative overflow-hidden">
      {/* Animated background orb */}
      <motion.div
        animate={{ x: [0, -35, 0], y: [0, 25, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/3 right-0 w-[450px] h-[450px] rounded-full bg-clay/[0.04] blur-3xl pointer-events-none"
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
              {faq.intro}
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
                      {item.question}
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="flex-shrink-0 mt-1"
                      >
                        <ChevronDown className="w-5 h-5 text-clay" />
                      </motion.span>
                    </button>
                  </h3>

                  {/* The answer stays mounted whether or not it is expanded, so
                      crawlers always see the text the FAQ schema promises. */}
                  <motion.div
                    id={`faq-answer-${i}`}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                    initial={false}
                    animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                    transition={{ duration: 0.35, ease: [0.23, 0.86, 0.39, 0.96] }}
                    className="overflow-hidden"
                  >
                    <p className="font-sans text-sm text-forest/65 leading-relaxed px-6 pb-5">
                      {item.answer}
                    </p>
                  </motion.div>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
