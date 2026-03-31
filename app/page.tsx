"use client";

import { useState } from "react";
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

export default function Home() {
  const [intakeOpen, setIntakeOpen] = useState(false);

  return (
    <main>
      <Navbar onBookSession={() => setIntakeOpen(true)} />
      <ScrollProgress />
      <Hero onBookSession={() => setIntakeOpen(true)} />
      <MarqueeDivider
        text1="Therapy · Mentoring · Growth · Healing"
        text2="CBT · Humanistic · Trauma-Informed · Care"
      />
      <About />
      <Services />
      <MarqueeDivider
        text1="Academic Stress · Anxiety · Self-Esteem · Boundaries"
        text2="Burnout · Overthinking · Identity · Transitions"
        className="bg-white"
      />
      <Issues />
      <Mentoring />
      <SessionInfo />
      <Contact onBookSession={() => setIntakeOpen(true)} />
      <Footer />
      <IntakeFormModal isOpen={intakeOpen} onClose={() => setIntakeOpen(false)} />
    </main>
  );
}
