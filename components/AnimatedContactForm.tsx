"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Check, Loader2, Sparkles, Heart } from "lucide-react";
import Reveal, { revealProps } from "./Reveal";
import { createSpring, prefersReducedMotion, type Spring } from "./spring";

/*
  Every effect in this form was framer-motion and is now CSS (the .form-* and
  .submit-* rules in motion.css) plus one small spring for the magnetic submit
  button. The values are framer-motion's own: springs are sampled into CSS
  linear() curves with the same stiffness and damping, keyframe loops keep
  their timings and per-segment easing, and each hover-out keeps the delay
  framer-motion gave it. The form is at the foot of the page, and this is what
  kept the animation library in the homepage's first download.
*/

interface FormData {
  name: string;
  email: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

/* ────────────────────────────────────────────
   Floating Label Input
   ──────────────────────────────────────────── */

function FloatingLabelInput({
  id,
  label,
  type,
  value,
  onChange,
  error,
  delay,
  isTextarea = false,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  delay: number;
  isTextarea?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number }[]
  >([]);

  const isFloating = isFocused || value.length > 0;
  const Tag = isTextarea ? "textarea" : "input";

  const handleFocus = () => {
    setIsFocused(true);
    const ps = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100 - 50,
      y: Math.random() * -50 - 10,
    }));
    setParticles(ps);
    setTimeout(() => setParticles([]), 1000);
  };

  // Swings in from the left on a stiffness 100 spring once 50px into view;
  // grows slightly on hover and springs back after its entrance delay.
  const field = revealProps(
    { x: -50, rotateY: -15, ease: "spring100", delay, margin: "-50px" },
    "form-field relative",
    { perspective: "1000px", transitionDelay: `${delay}s` }
  );

  return (
    <div {...field}>
      {/* Focus particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="form-particle absolute top-1/2 left-1/2 w-2 h-2 bg-clay rounded-full pointer-events-none z-20"
          style={{ "--px": `${p.x}px`, "--py": `${p.y}px` } as React.CSSProperties}
        />
      ))}

      {/* The label floats up on a lively spring (stiffness 300, damping 10). */}
      <label
        htmlFor={id}
        className="form-label absolute left-4 pointer-events-none opacity-70 z-10 font-sans font-medium"
        style={{
          top: isFloating ? "0.5rem" : isTextarea ? "1.25rem" : "50%",
          fontSize: isFloating ? "0.75rem" : "1rem",
          translate: isFloating || isTextarea ? "0 0" : "0 -50%",
          color: isFocused ? "#c17f5e" : "#f7f3ed",
        }}
      >
        {label}
      </label>

      <Tag
        id={id}
        type={isTextarea ? undefined : type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
        onFocus={handleFocus}
        onBlur={() => setIsFocused(false)}
        rows={isTextarea ? 5 : undefined}
        className={`w-full bg-gradient-to-br from-forest/50 to-forest-deep/50 border-2 ${
          error
            ? "border-red-400/60 shadow-[0_0_20px_rgba(200,90,84,0.2)]"
            : isFocused
            ? "border-clay/70 shadow-[0_0_30px_rgba(193,127,94,0.15)]"
            : "border-sage/25"
        } rounded-xl px-4 ${
          isTextarea ? "pt-8 pb-4 min-h-[150px]" : "pt-6 pb-2 h-14"
        } font-sans text-sm text-cream placeholder-transparent focus:outline-none transition-all duration-300 resize-none backdrop-blur-sm`}
      />

      {isTextarea && value.length > 0 && (
        <div className="form-pop-in absolute bottom-2 right-3 text-xs text-clay/50 font-sans">
          {value.length} chars
        </div>
      )}

      {error && (
        <p
          id={`${id}-error`}
          className="form-slide-in text-red-400 text-xs mt-1 ml-1 font-sans flex items-center gap-1"
        >
          <span className="inline-block w-1 h-1 bg-red-400 rounded-full animate-pulse" />
          {error}
        </p>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   Magnetic Submit Button
   ──────────────────────────────────────────── */

function SubmitButton({
  disabled,
  isLoading,
  isSuccess,
}: {
  disabled: boolean;
  isLoading: boolean;
  isSuccess: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const spring = useRef<Spring | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => () => spring.current?.stop(), []);

  // Leans toward the pointer on a stiffness 300, damping 20 spring. Written to
  // the `translate` property, so the hover scale and wiggle (CSS, on `scale`
  // and `rotate`) compose with it rather than fighting over `transform`.
  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el || disabled || prefersReducedMotion()) return;
    spring.current ??= createSpring(
      { stiffness: 300, damping: 20 },
      [0, 0],
      ([x, y]) => {
        el.style.translate = x || y ? `${x}px ${y}px` : "";
      }
    );
    const rect = el.getBoundingClientRect();
    spring.current.set([
      (e.clientX - rect.left - rect.width / 2) * 0.4,
      (e.clientY - rect.top - rect.height / 2) * 0.4,
    ]);
  };

  // Ripple only — submission runs through the form's onSubmit, so keyboard
  // "Enter" in a field behaves the same as a click.
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const rip = { id: Date.now(), x: e.clientX - rect.left, y: e.clientY - rect.top };
      setRipples((p) => [...p, rip]);
      setTimeout(() => setRipples((p) => p.filter((r) => r.id !== rip.id)), 600);
    }
  };

  return (
    <button
      ref={ref}
      type="submit"
      onClick={handleClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => spring.current?.set([0, 0])}
      className={`submit-btn relative w-full h-14 rounded-2xl font-sans font-semibold text-base transition-all overflow-hidden ${
        disabled
          ? "bg-sage/30 cursor-not-allowed"
          : "bg-gradient-to-r from-clay via-clay-light to-clay hover:shadow-[0_0_40px_rgba(193,127,94,0.3)] cursor-pointer"
      } text-cream flex items-center justify-center gap-2 shadow-lg`}
    >
      {/* Ripples */}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="submit-ripple absolute w-20 h-20 bg-white rounded-full pointer-events-none"
          style={{ left: r.x - 40, top: r.y - 40 }}
        />
      ))}

      {/* Shimmer. The same sweep as framer-motion's background-position loop
          on a 200%-wide gradient, but moving the gradient itself (a
          transform), which the compositor can run without the main thread. */}
      {!disabled && !isSuccess && (
        <div className="submit-shimmer absolute inset-y-0 left-0 w-[200%] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}

      {/* Success */}
      {isSuccess && (
        <div className="submit-success absolute inset-0 bg-gradient-to-br from-forest to-sage flex items-center justify-center">
          <div className="submit-check">
            <Check className="w-7 h-7 text-cream" />
          </div>
          {/* Confetti */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="submit-confetti absolute w-2 h-2 rounded-full"
              style={
                {
                  backgroundColor:
                    i % 3 === 0 ? "#c17f5e" : i % 3 === 1 ? "#f7f3ed" : "#8a9e8c",
                  "--cx": `${Math.cos((i / 12) * Math.PI * 2) * 80}px`,
                  "--cy": `${Math.sin((i / 12) * Math.PI * 2) * 80}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* Loading */}
      {!isSuccess && isLoading && (
        <Loader2 className="w-6 h-6 animate-spin relative z-10" />
      )}

      {/* Default */}
      {!isSuccess && !isLoading && (
        <div className="submit-label flex items-center gap-2 relative z-10">
          <span>Send Message</span>
          <div className="submit-send">
            <Send className="w-5 h-5" />
          </div>
        </div>
      )}
    </button>
  );
}

/* ────────────────────────────────────────────
   Main Form
   ──────────────────────────────────────────── */

export default function AnimatedContactForm() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!formData.name.trim()) e.name = "Name is required";
    if (!formData.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      e.email = "Invalid email format";
    if (!formData.message.trim()) e.message = "Message is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) {
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      return;
    }
    setIsLoading(true);
    setErrors({});
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Something went wrong. Please email me directly."
        );
      }
      setIsSuccess(true);
      setTimeout(() => {
        setFormData({ name: "", email: "", message: "" });
        setIsSuccess(false);
      }, 3000);
    } catch {
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      setErrors({ message: "Failed to send message. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (shouldShake && formRef.current) {
      formRef.current.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-10px)" },
          { transform: "translateX(10px)" },
          { transform: "translateX(-10px)" },
          { transform: "translateX(10px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 500, easing: "ease-in-out" }
      );
    }
  }, [shouldShake]);

  // Tips up out of the page on a stiffness 100 spring as it scrolls in.
  const card = revealProps(
    { scale: 0.9, rotateX: 10, ease: "spring100" },
    "w-full max-w-lg mx-auto bg-gradient-to-br from-forest-deep to-forest rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] p-8 md:p-10 border border-sage/15 backdrop-blur-xl relative overflow-hidden",
    { perspective: "1000px" }
  );

  return (
    <div ref={formRef} {...card}>
      {/* Decorative corner elements */}
      <div className="form-spin absolute top-4 right-4">
        <Sparkles className="w-5 h-5 text-clay opacity-25" />
      </div>
      <div className="form-heartbeat absolute bottom-4 left-4">
        <Heart className="w-4 h-4 text-clay opacity-20" />
      </div>

      {/* Inner glow */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-sage/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-clay/10 rounded-full blur-3xl pointer-events-none" />

      <form onSubmit={handleSubmit} noValidate className="relative space-y-5">
        <FloatingLabelInput
          id="name"
          label="Your Name"
          type="text"
          value={formData.name}
          onChange={(v) => setFormData({ ...formData, name: v })}
          error={errors.name}
          delay={0.1}
        />
        <FloatingLabelInput
          id="email"
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={(v) => setFormData({ ...formData, email: v })}
          error={errors.email}
          delay={0.2}
        />
        <FloatingLabelInput
          id="message"
          label="Your Message"
          type="text"
          value={formData.message}
          onChange={(v) => setFormData({ ...formData, message: v })}
          error={errors.message}
          delay={0.3}
          isTextarea
        />

        <Reveal y={30} duration={0.5} delay={0.4} ease="out">
          <SubmitButton
            disabled={isLoading || isSuccess}
            isLoading={isLoading}
            isSuccess={isSuccess}
          />
        </Reveal>
      </form>

      {isSuccess && (
        <p className="form-rise-in text-sage text-center mt-4 font-sans text-sm font-medium">
          Message sent successfully! We&apos;ll respond within 24 hours.
        </p>
      )}
    </div>
  );
}
