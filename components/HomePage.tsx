"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { PublicSiteContent } from "@/lib/content";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Services from "@/components/Services";
import Issues from "@/components/Issues";
import Mentoring from "@/components/Mentoring";
import Faq from "@/components/Faq";
import SessionInfo from "@/components/SessionInfo";
import Contact from "@/components/Contact";
import BreathingPause from "@/components/BreathingPause";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import MarqueeDivider from "@/components/MarqueeDivider";
import RevealObserver from "@/components/RevealObserver";
import type { PostLink } from "@/components/RelatedReading";

/*
  The modal is only ever opened on interaction, so it stays out of the initial
  bundle entirely — and it is not even fetched until it is wanted. It used to
  be rendered (closed) from the start, which downloaded and ran it, and the
  framer-motion it animates with, while the page was still loading. Now it
  mounts the first time someone opens it and then stays mounted, so its close
  animation and its state behave exactly as before.

  webpackPrefetch lets the browser fetch the chunk at idle, at low priority,
  without running it, so opening it is not held up by the download.
*/
const IntakeFormModal = dynamic(
  () => import(/* webpackPrefetch: true */ "@/components/IntakeFormModal"),
  { ssr: false }
);

export default function HomePage({
  content,
  posts = [],
  localCurrency = false,
}: {
  content: PublicSiteContent;
  posts?: PostLink[];
  /** The rollout switch, read on the server. Off renders rupees, as before. */
  localCurrency?: boolean;
}) {
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeMounted, setIntakeMounted] = useState(false);

  // Phase 4 — shareable intake URL. Read from `window` rather than
  // `useSearchParams`, which would opt the whole page out of prerendering.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("intake") === "true") {
      setIntakeMounted(true);
      setIntakeOpen(true);
    }
  }, []);

  const openIntake = () => {
    setIntakeMounted(true);
    setIntakeOpen(true);
    window.history.pushState({}, "", "/?intake=true");
  };

  const closeIntake = () => {
    setIntakeOpen(false);
    window.history.pushState({}, "", "/");
  };

  return (
    <>
      <Navbar onBookSession={openIntake} />
      <ScrollProgress />
      <main>
        <Hero
          hero={content.hero}
          sessionLength={content.sessionLength}
          onBookSession={openIntake}
        />
        <MarqueeDivider
          text1="Therapy · Mentoring · Growth · Healing"
          text2="CBT · Humanistic · Trauma-Informed · Care"
        />
        <About about={content.about} />
        <Services services={content.services} localCurrency={localCurrency} />
        <MarqueeDivider
          text1="Academic Stress · Anxiety · Self-Esteem · Boundaries"
          text2="Burnout · Overthinking · Identity · Transitions"
          className="bg-white"
        />
        <Issues issues={content.issues} posts={posts} />
        <Mentoring mentoring={content.mentoring} />
        <Faq faq={content.faq} localCurrency={localCurrency} />
        <SessionInfo
          structure={content.sessionStructure}
          crisis={content.crisis}
          sessionLength={content.sessionLength}
          posts={posts}
        />
        <BreathingPause />
        <Contact contact={content.contact} onBookSession={openIntake} />
      </main>
      <Footer
        instagram={content.social?.instagram}
        linkedin={content.social?.linkedin}
      />
      {intakeMounted && (
        <IntakeFormModal
          isOpen={intakeOpen}
          onClose={closeIntake}
          slidingScale={content.slidingScale}
          localCurrency={localCurrency}
          calendlyUrl={content.calendlyUrl}
          studentNote={content.studentNote}
          intakeForm={content.intakeForm}
        />
      )}
      <RevealObserver />
    </>
  );
}
