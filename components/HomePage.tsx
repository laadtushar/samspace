"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { SiteContent } from "@/lib/content";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Services from "@/components/Services";
import Issues from "@/components/Issues";
import Mentoring from "@/components/Mentoring";
import SessionInfo from "@/components/SessionInfo";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import MarqueeDivider from "@/components/MarqueeDivider";
import IntakeFormModal from "@/components/IntakeFormModal";

export default function HomePage({ content }: { content: SiteContent }) {
  const [intakeOpen, setIntakeOpen] = useState(false);
  const searchParams = useSearchParams();

  // Phase 4 — shareable intake URL
  useEffect(() => {
    if (searchParams.get("intake") === "true") {
      setIntakeOpen(true);
    }
  }, [searchParams]);

  const openIntake = () => {
    setIntakeOpen(true);
    window.history.pushState({}, "", "/?intake=true");
  };

  const closeIntake = () => {
    setIntakeOpen(false);
    window.history.pushState({}, "", "/");
  };

  return (
    <main>
      <Navbar onBookSession={openIntake} />
      <ScrollProgress />
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
      <SessionInfo />
      <Contact contact={content.contact} onBookSession={openIntake} />
      <Footer />
      <IntakeFormModal
        isOpen={intakeOpen}
        onClose={closeIntake}
        slidingScale={content.slidingScale}
      />
    </main>
  );
}
