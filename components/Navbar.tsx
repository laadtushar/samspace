"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Mentoring", href: "#mentoring" },
  { label: "FAQ", href: "#faq" },
  { label: "Writing", href: "/blog" },
];

export default function Navbar({ onBookSession }: { onBookSession?: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The same nav renders on /blog, where the homepage sections don't exist —
  // an anchor with nothing to scroll to has to become a navigation instead of
  // silently doing nothing.
  const handleNavClick = (href: string) => {
    setMenuOpen(false);
    if (!href.startsWith("#")) {
      router.push(href);
      return;
    }
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push(`/${href}`);
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-cream/80 backdrop-blur-md shadow-sm border-b border-sage/20"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => {
            if (window.location.pathname === "/") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              router.push("/");
            }
          }}
          // py-1/-my-1: a 40px tap target for the wordmark without moving it.
          className="flex flex-col leading-none py-1 -my-1"
        >
          <span className="font-serif text-2xl font-semibold text-forest tracking-wide">
            Samvriti.Space
          </span>
          <span className="text-[10px] font-sans text-sage tracking-widest uppercase hidden sm:block">
            A space to feel seen, heard, and supported.
          </span>
        </button>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <li key={link.href}>
              <button
                onClick={() => handleNavClick(link.href)}
                className="font-sans text-sm text-forest/70 hover:text-forest transition-colors duration-200 tracking-wide"
              >
                {link.label}
              </button>
            </li>
          ))}
          <li>
            <button
              onClick={() => { onBookSession?.(); setMenuOpen(false); }}
              className="font-sans text-sm bg-forest text-cream px-5 py-2.5 rounded-full hover:bg-forest/90 transition-all duration-200 tracking-wide"
            >
              Book a Session
            </button>
          </li>
        </ul>

        {/* Hamburger */}
        <button
          // -mr-1 keeps the bars visually where they were while the button
          // itself grows to a 48px target.
          className="md:hidden flex flex-col gap-1.5 p-3 -mr-1"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span
            className={`block w-6 h-0.5 bg-forest transition-all duration-300 ${
              menuOpen ? "rotate-45 translate-y-2" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-forest transition-all duration-300 ${
              menuOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-forest transition-all duration-300 ${
              menuOpen ? "-rotate-45 -translate-y-2" : ""
            }`}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-cream/95 backdrop-blur-md border-b border-sage/20"
          >
            <ul className="flex flex-col px-6 py-4 gap-4">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => handleNavClick(link.href)}
                    className="font-sans text-sm w-full text-left tracking-wide py-1 text-forest/80 hover:text-forest transition-colors duration-200"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
              <li>
                <button
                  onClick={() => { onBookSession?.(); setMenuOpen(false); }}
                  className="font-sans text-sm w-full text-left tracking-wide py-1 text-clay font-medium transition-colors duration-200"
                >
                  Book a Session
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
