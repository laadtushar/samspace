"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { SiteContent } from "@/lib/content";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Services from "@/components/Services";
import Issues from "@/components/Issues";
import Mentoring from "@/components/Mentoring";
import Faq from "@/components/Faq";
import SessionInfo from "@/components/SessionInfo";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import MarqueeDivider from "@/components/MarqueeDivider";

// The modal is only ever opened on interaction, so it stays out of the initial
// bundle entirely.
const IntakeFormModal = dynamic(() => import("@/components/IntakeFormModal"), {
  ssr: false,
});

export default function HomePage({ content }: { content: SiteContent }) {
  const [intakeOpen, setIntakeOpen] = useState(false);

  // Phase 4 — shareable intake URL. Read from `window` rather than
  // `useSearchParams`, which would opt the whole page out of prerendering.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("intake") === "true") {
      setIntakeOpen(true);
    }
  }, []);

  const openIntake = () => {
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
        <Hero hero={content.hero} onBookSession={openIntake} />
        <MarqueeDivider
          text1="Therapy · Mentoring · Growth · Healing"
          text2="CBT · Humanistic · Trauma-Informed · Care"
        />
        <About about={content.about} />
        <Services services={content.services} />
        <MarqueeDivider
          text1="Academic Stress · Anxiety · Self-Esteem · Boundaries"
          text2="Burnout · Overthinking · Identity · Transitions"
          className="bg-white"
        />
        <Issues issues={content.issues} />
        <Mentoring mentoring={content.mentoring} />
        <Faq faq={content.faq} />
        <SessionInfo />
        <Contact contact={content.contact} social={content.social} onBookSession={openIntake} />
      </main>
      <Footer
        instagram={content.social?.instagram}
        linkedin={content.social?.linkedin}
      />
      <IntakeFormModal
        isOpen={intakeOpen}
        onClose={closeIntake}
        slidingScale={content.slidingScale}
        calendlyUrl={content.calendlyUrl}
        studentNote={content.studentNote}
      />
    </>
  );
}
