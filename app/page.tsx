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

export default function Home() {
  return (
    <main>
      <Navbar />
      <ScrollProgress />
      <Hero />
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
      <Contact />
      <Footer />
    </main>
  );
}
