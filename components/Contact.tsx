"use client";

import { Clock, Mail, MessageCircle } from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import Reveal from "./Reveal";
import TextReveal from "./TextReveal";
import AnimatedContactForm from "./AnimatedContactForm";

interface ContactProps {
  contact: {
    heading: string;
    subtext: string;
    email: string;
    whatsappLink?: string;
  };
  onBookSession?: () => void;
}

export default function Contact({ contact, onBookSession }: ContactProps) {
  /*
    The WhatsApp card appears only when a link is configured, and the link is a
    handle rather than wa.me/<number> — the schema refuses a number outright. So
    it can go straight in the href: the redirect that used to hide the number
    from the markup was never hiding it from anyone who clicked.
  */
  const infoCards = [
    { icon: Mail, label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    ...(contact.whatsappLink
      ? [
          {
            icon: MessageCircle,
            label: "WhatsApp",
            value: "Send a message",
            href: contact.whatsappLink as string | null,
          },
        ]
      : []),
    { icon: Clock, label: "Response Time", value: "Within 24 hours", href: null as string | null },
  ];
  return (
    <section id="contact" className="bg-forest text-cream py-28 relative overflow-hidden">
      {/* Ambient orbs — CSS loops (.drift) */}
      <div
        className="drift absolute top-20 right-20 w-72 h-72 rounded-full bg-sage/[0.06] blur-3xl pointer-events-none"
        style={
          { "--drift-x": "30px", "--drift-y": "-20px", "--drift-duration": "18s" } as React.CSSProperties
        }
      />
      <div
        className="drift absolute bottom-20 left-20 w-60 h-60 rounded-full bg-clay/[0.04] blur-3xl pointer-events-none"
        style={
          { "--drift-x": "-20px", "--drift-y": "25px", "--drift-duration": "15s" } as React.CSSProperties
        }
      />

      <div className="relative max-w-4xl mx-auto px-6">
        <AnimatedSection>
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl sm:text-5xl font-semibold mb-5">
              <TextReveal
                text={contact.heading}
                staggerDelay={0.06}
                className="text-cream"
              />
            </h2>
            <Reveal
              as="p"
              duration={0.8}
              delay={0.6}
              ease="out"
              className="font-sans text-base text-cream/55 max-w-md mx-auto"
            >
              {contact.subtext}
            </Reveal>
          </div>
        </AnimatedSection>

        {/* Info cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-16">
          {infoCards.map((c, i) => (
            /*
              The hover lift moves on the entrance's own timing, delay
              included, in both directions — as it did in framer-motion.
            */
            <Reveal
              key={c.label}
              y={30}
              scale={0.9}
              duration={0.6}
              delay={0.2 + i * 0.12}
              ease="soft"
              className="lift bg-cream/[0.06] backdrop-blur-sm border border-cream/[0.1] rounded-2xl p-7 text-center cursor-default group"
              style={{ "--lift-y": "-6px", "--lift-scale": 1.03 } as React.CSSProperties}
            >
              <span
                className="hover-pop text-3xl mb-3 block"
                style={{ "--pop-scale": 1.3 } as React.CSSProperties}
              >
                <c.icon className="w-7 h-7 mx-auto text-clay-light" aria-hidden="true" strokeWidth={1.5} />
              </span>
              <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-cream/70 mb-2">
                {c.label}
              </p>
              {c.href ? (
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  // inline-block with vertical padding so the link is a
                  // thumb-sized target rather than a 16px line of text.
                  className="inline-block py-3 font-sans text-sm text-cream/85 font-medium break-all group-hover:text-clay transition-colors duration-300 underline underline-offset-2 decoration-cream/20 hover:decoration-clay/50"
                >
                  {c.value}
                </a>
              ) : (
                <p className="font-sans text-sm text-cream/85 font-medium break-all group-hover:text-clay transition-colors duration-300">
                  {c.value}
                </p>
              )}
            </Reveal>
          ))}
        </div>

        {/* Book Session CTA */}
        <AnimatedSection delay={0.15}>
          <div className="text-center mb-14">
            {/* Grows on hover and dips when pressed, on framer-motion's
                default scale spring (.press-grow). */}
            <button
              onClick={() => onBookSession?.()}
              className="press-grow font-sans text-sm font-medium bg-clay text-cream px-8 py-4 rounded-full hover:bg-clay-light shadow-lg shadow-clay/20 mb-3"
            >
              Fill Therapy Intake Form
            </button>
            <p className="font-sans text-xs text-cream/40">or send a quick message below</p>
          </div>
        </AnimatedSection>

        {/* Animated Contact Form */}
        <AnimatedContactForm />

        {/*
          The profile links used to be repeated here under an "Elsewhere"
          heading. The footer carries the same pair on every page and sits
          directly below this section, so on a phone the identical two icons
          appeared twice within a single screen. The footer's copy is the one
          that survives, because it is on every page rather than only this one.
        */}
      </div>
    </section>
  );
}
