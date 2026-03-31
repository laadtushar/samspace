"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { Send, Check, Loader2, Sparkles, Heart } from "lucide-react";

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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

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

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -50, rotateY: -15 }}
      animate={
        isInView
          ? { opacity: 1, x: 0, rotateY: 0 }
          : { opacity: 0, x: -50, rotateY: -15 }
      }
      transition={{ duration: 0.6, delay, type: "spring", stiffness: 100 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className="relative"
      style={{ perspective: "1000px" }}
    >
      {/* Focus particles */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: p.x, y: p.y, scale: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" as const }}
            className="absolute top-1/2 left-1/2 w-2 h-2 bg-clay rounded-full pointer-events-none z-20"
          />
        ))}
      </AnimatePresence>

      <motion.label
        htmlFor={id}
        animate={{
          top: isFloating ? "0.5rem" : isTextarea ? "1.25rem" : "50%",
          fontSize: isFloating ? "0.75rem" : "1rem",
          y: isFloating ? 0 : isTextarea ? 0 : "-50%",
          color: isFocused ? "#c17f5e" : "#f7f3ed",
        }}
        transition={{ duration: 0.2, type: "spring", stiffness: 300 }}
        className="absolute left-4 pointer-events-none opacity-70 z-10 font-sans font-medium"
      >
        {label}
      </motion.label>

      <Tag
        id={id}
        type={isTextarea ? undefined : type}
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
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bottom-2 right-3 text-xs text-clay/50 font-sans"
        >
          {value.length} chars
        </motion.div>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-red-400 text-xs mt-1 ml-1 font-sans flex items-center gap-1"
        >
          <span className="inline-block w-1 h-1 bg-red-400 rounded-full animate-pulse" />
          {error}
        </motion.p>
      )}
    </motion.div>
  );
}

/* ────────────────────────────────────────────
   Magnetic Submit Button
   ──────────────────────────────────────────── */

function SubmitButton({
  onClick,
  disabled,
  isLoading,
  isSuccess,
}: {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
  isSuccess: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { damping: 20, stiffness: 300 });
  const springY = useSpring(y, { damping: 20, stiffness: 300 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.4);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.4);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const rip = { id: Date.now(), x: e.clientX - rect.left, y: e.clientY - rect.top };
      setRipples((p) => [...p, rip]);
      setTimeout(() => setRipples((p) => p.filter((r) => r.id !== rip.id)), 600);
    }
    onClick();
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={handleClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ x: springX, y: springY }}
      whileHover={{
        scale: disabled ? 1 : 1.05,
        rotate: disabled ? 0 : [0, -2, 2, -2, 0],
        transition: { rotate: { duration: 0.5 } },
      }}
      whileTap={{ scale: disabled ? 1 : 0.92 }}
      className={`relative w-full h-14 rounded-2xl font-sans font-semibold text-base transition-all overflow-hidden ${
        disabled
          ? "bg-sage/30 cursor-not-allowed"
          : "bg-gradient-to-r from-clay via-clay-light to-clay hover:shadow-[0_0_40px_rgba(193,127,94,0.3)] cursor-pointer"
      } text-cream flex items-center justify-center gap-2 shadow-lg`}
    >
      {/* Ripples */}
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" as const }}
            className="absolute w-20 h-20 bg-white rounded-full pointer-events-none"
            style={{ left: r.x - 40, top: r.y - 40 }}
          />
        ))}
      </AnimatePresence>

      {/* Shimmer */}
      {!disabled && !isSuccess && (
        <motion.div
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          style={{ backgroundSize: "200% 100%" }}
        />
      )}

      {/* Success */}
      {isSuccess && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="absolute inset-0 bg-gradient-to-br from-forest to-sage flex items-center justify-center"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.5 }}
          >
            <Check className="w-7 h-7 text-cream" />
          </motion.div>
          {/* Confetti */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{
                scale: [0, 1, 0],
                x: Math.cos((i / 12) * Math.PI * 2) * 80,
                y: Math.sin((i / 12) * Math.PI * 2) * 80,
              }}
              transition={{ duration: 1, delay: 0.1 }}
              className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  i % 3 === 0 ? "#c17f5e" : i % 3 === 1 ? "#f7f3ed" : "#8a9e8c",
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Loading */}
      {!isSuccess && isLoading && (
        <Loader2 className="w-6 h-6 animate-spin relative z-10" />
      )}

      {/* Default */}
      {!isSuccess && !isLoading && (
        <motion.div className="flex items-center gap-2 relative z-10" whileHover={{ gap: "12px" }}>
          <span>Send Message</span>
          <motion.div
            animate={{ x: [0, 5, 0], rotate: [0, -15, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
          >
            <Send className="w-5 h-5" />
          </motion.div>
        </motion.div>
      )}
    </motion.button>
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

  const handleSubmit = async () => {
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
      if (!res.ok) throw new Error("Failed");
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

  return (
    <motion.div
      ref={formRef}
      initial={{ opacity: 0, scale: 0.9, rotateX: 10 }}
      whileInView={{ opacity: 1, scale: 1, rotateX: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, type: "spring", stiffness: 100 }}
      className="w-full max-w-lg mx-auto bg-gradient-to-br from-forest-deep to-forest rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] p-8 md:p-10 border border-sage/15 backdrop-blur-xl relative overflow-hidden"
      style={{ perspective: "1000px" }}
    >
      {/* Decorative corner elements */}
      <motion.div
        className="absolute top-4 right-4"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        <Sparkles className="w-5 h-5 text-clay opacity-25" />
      </motion.div>
      <motion.div
        className="absolute bottom-4 left-4"
        animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <Heart className="w-4 h-4 text-clay opacity-20" />
      </motion.div>

      {/* Inner glow */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-sage/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-clay/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative space-y-5">
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

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <SubmitButton
            onClick={handleSubmit}
            disabled={isLoading || isSuccess}
            isLoading={isLoading}
            isSuccess={isSuccess}
          />
        </motion.div>
      </div>

      {isSuccess && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sage text-center mt-4 font-sans text-sm font-medium"
        >
          Message sent successfully! We&apos;ll respond within 24 hours.
        </motion.p>
      )}
    </motion.div>
  );
}
