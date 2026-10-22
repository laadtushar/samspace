"use client";

import AnimatedSection from "./AnimatedSection";
import MagneticButton from "./MagneticButton";
import Reveal from "./Reveal";
import TextReveal from "./TextReveal";
import RelatedReading, { type PostLink } from "./RelatedReading";

interface IssuesProps {
  issues: { heading: string; intro: string; items: string[] };
  posts?: PostLink[];
}

export default function Issues({ issues, posts = [] }: IssuesProps) {
  /*
    The areas above are pills with no way in. Someone reading "anxiety &
    overthinking" and wondering whether theirs counts has, at that moment, no
    next step short of booking — so the posts that answer exactly that question
    go here, rather than three clicks away under a separate nav item.

    Matched by tag against what is published, so this is never a list to
    maintain, and shows nothing when nothing matches.
  */
  const suggested = posts
    .filter((post) =>
      post.tags.some((tag) =>
        ["anxiety", "overthinking", "starting therapy", "self-doubt"].includes(
          tag.toLowerCase()
        )
      )
    )
    .slice(0, 3);
  return (
    <section className="bg-white py-28 relative overflow-hidden">
      {/* Animated background orb */}
      {/*
        A CSS loop now (.drift in globals.css). It carries no -translate-1/2
        centring classes: framer-motion's inline transform always overrode
        them, so the orb has only ever sat with its corner at the centre, and
        a CSS animation would override them the same way.
      */}
      <div
        className="drift absolute top-1/2 left-1/2 w-[500px] h-[500px] rounded-full bg-sage/[0.04] blur-3xl pointer-events-none"
        style={
          { "--drift-x": "40px", "--drift-y": "-30px", "--drift-duration": "20s" } as React.CSSProperties
        }
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <AnimatedSection>
            <span className="font-sans text-xs font-medium tracking-[0.3em] uppercase text-clay mb-4 block">
              Areas of Support
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl font-semibold text-forest mb-6 leading-tight">
              <TextReveal
                text={issues.heading}
                staggerDelay={0.05}
              />
            </h2>
            <p className="font-sans text-base text-forest/55 leading-relaxed">
              {issues.intro}
            </p>
            <RelatedReading
              posts={suggested}
              label="Not sure if this applies to you?"
              className="mt-8 pt-8 border-t border-sage/15"
            />
          </AnimatedSection>

          {/* Right — magnetic pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {issues.items.map((issue, i) => (
              <Reveal
                key={issue}
                x={30}
                blur={6}
                duration={0.5}
                delay={0.1 + i * 0.07}
                ease="soft"
              >
                <MagneticButton strength={0.2} className="w-full">
                  <div className="bg-cream border border-sage/20 rounded-xl px-5 py-4 font-sans text-sm text-forest/75 hover:border-clay/50 hover:bg-clay/[0.04] hover:text-forest transition-all duration-300 cursor-default w-full">
                    {issue}
                  </div>
                </MagneticButton>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
