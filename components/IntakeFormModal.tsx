"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check, Heart, ChevronRight, ChevronLeft } from "lucide-react";

interface IntakeData {
  name: string;
  email: string;
  gender: string;
  age: string;
  whatsapp: string;
  education: string;
  preferredLanguage: string;
  concerns: string;
  slidingScale: string;
}

const slidingScaleOptions = ["₹500", "₹600", "₹700", "₹800"];
const genderOptions = ["Female", "Male", "Non-binary", "Prefer not to say"];
const languageOptions = ["English", "Hindi", "Both (English + Hindi)"];

const initialData: IntakeData = {
  name: "",
  email: "",
  gender: "",
  age: "",
  whatsapp: "",
  education: "",
  preferredLanguage: "",
  concerns: "",
  slidingScale: "",
};

// ─── Step definitions ───────────────────────────────
const steps = [
  { id: "intro", title: "Welcome" },
  { id: "personal", title: "About You" },
  { id: "contact", title: "Contact" },
  { id: "concerns", title: "Your Concerns" },
  { id: "preferences", title: "Preferences" },
];

export default function IntakeFormModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<IntakeData>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState(1);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const update = (field: keyof IntakeData, value: string) => {
    setData({ ...data, [field]: value });
    setError("");
  };

  const next = () => {
    // Validate current step
    if (step === 1) {
      if (!data.name || !data.gender || !data.age) {
        setError("Please fill all fields");
        return;
      }
    } else if (step === 2) {
      if (!data.email || !data.whatsapp) {
        setError("Please fill all fields");
        return;
      }
    } else if (step === 3) {
      if (!data.concerns) {
        setError("Please describe your concerns");
        return;
      }
    }
    setDirection(1);
    setStep((s) => Math.min(s + 1, steps.length - 1));
    setError("");
  };

  const prev = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
    setError("");
  };

  const handleSubmit = async () => {
    if (!data.slidingScale) {
      setError("Please select a preference");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setData(initialData);
        setStep(0);
        onClose();
      }, 3000);
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setStep(0);
      setError("");
      setData(initialData);
      onClose();
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-forest/70 backdrop-blur-md"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-cream rounded-3xl shadow-2xl shadow-forest/40"
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-forest/10 flex items-center justify-center hover:bg-forest/20 transition-colors"
            >
              <X className="w-4 h-4 text-forest" />
            </button>

            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-sage/20 rounded-t-3xl overflow-hidden">
              <motion.div
                className="h-full bg-clay"
                animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.4, ease: "easeOut" as const }}
              />
            </div>

            <div className="p-8 pt-10">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6">
                {steps.map((s, i) => (
                  <div
                    key={s.id}
                    className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${
                      i <= step ? "bg-clay" : "bg-sage/20"
                    }`}
                  />
                ))}
              </div>

              {/* Animated step content */}
              <div className="overflow-hidden min-h-[340px]">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: "easeInOut" as const }}
                  >
                    {/* Step 0 — Intro */}
                    {step === 0 && (
                      <div>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: "spring" }}
                          className="w-16 h-16 bg-forest rounded-2xl flex items-center justify-center mb-6 mx-auto"
                        >
                          <Heart className="w-8 h-8 text-cream" />
                        </motion.div>
                        <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-forest text-center mb-4">
                          Therapy Intake Form
                        </h2>
                        <p className="font-sans text-sm text-forest/60 leading-relaxed text-center mb-4">
                          I&apos;m Priyanka Varma, a psychologist working under supervision
                          with a master&apos;s degree in clinical psychology. I use an
                          eclectic and personalised approach integrating CBT, Humanistic,
                          Trauma-Informed Care, and mindfulness-based practices.
                        </p>
                        <div className="bg-forest/5 rounded-xl p-4 mb-4">
                          <p className="font-sans text-xs text-forest/50 text-center leading-relaxed">
                            🌿 Sessions are conducted online &nbsp;·&nbsp;
                            💫 Sliding scale: ₹500–₹800/session &nbsp;·&nbsp;
                            🔒 All information remains confidential
                          </p>
                        </div>
                        <p className="font-sans text-xs text-forest/40 text-center italic">
                          This form helps me understand your needs and check availability.
                        </p>
                      </div>
                    )}

                    {/* Step 1 — Personal */}
                    {step === 1 && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold text-forest mb-6">
                          Tell me about yourself
                        </h3>
                        <div className="space-y-4">
                          <FormInput
                            label="Full Name"
                            value={data.name}
                            onChange={(v) => update("name", v)}
                            required
                          />
                          <div>
                            <label className="font-sans text-xs font-medium text-forest/60 uppercase tracking-wider mb-2 block">
                              Gender <span className="text-clay">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {genderOptions.map((g) => (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => update("gender", g)}
                                  className={`font-sans text-sm py-2.5 px-4 rounded-xl border-2 transition-all duration-200 ${
                                    data.gender === g
                                      ? "border-clay bg-clay/10 text-clay font-medium"
                                      : "border-sage/20 text-forest/60 hover:border-sage/40"
                                  }`}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                          </div>
                          <FormInput
                            label="Age"
                            value={data.age}
                            onChange={(v) => update("age", v)}
                            type="number"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* Step 2 — Contact */}
                    {step === 2 && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold text-forest mb-6">
                          How can I reach you?
                        </h3>
                        <div className="space-y-4">
                          <FormInput
                            label="Email Address"
                            value={data.email}
                            onChange={(v) => update("email", v)}
                            type="email"
                            required
                          />
                          <FormInput
                            label="WhatsApp Number"
                            value={data.whatsapp}
                            onChange={(v) => update("whatsapp", v)}
                            required
                          />
                          <FormInput
                            label="Education & Occupation"
                            value={data.education}
                            onChange={(v) => update("education", v)}
                          />
                          <div>
                            <label className="font-sans text-xs font-medium text-forest/60 uppercase tracking-wider mb-2 block">
                              Preferred Language
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {languageOptions.map((l) => (
                                <button
                                  key={l}
                                  type="button"
                                  onClick={() => update("preferredLanguage", l)}
                                  className={`font-sans text-sm py-2 px-4 rounded-xl border-2 transition-all duration-200 ${
                                    data.preferredLanguage === l
                                      ? "border-clay bg-clay/10 text-clay font-medium"
                                      : "border-sage/20 text-forest/60 hover:border-sage/40"
                                  }`}
                                >
                                  {l}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 3 — Concerns */}
                    {step === 3 && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold text-forest mb-2">
                          What brings you to therapy?
                        </h3>
                        <p className="font-sans text-xs text-forest/50 mb-6">
                          Please briefly describe your concerns (e.g., stress, anxiety, relationship issues, low mood, self-esteem, etc.)
                        </p>
                        <textarea
                          value={data.concerns}
                          onChange={(e) => update("concerns", e.target.value)}
                          rows={6}
                          placeholder="Take your time — there are no wrong answers..."
                          className="w-full bg-white border-2 border-sage/20 rounded-xl px-4 py-3 font-sans text-sm text-forest placeholder:text-forest/30 focus:outline-none focus:border-clay/50 transition-colors resize-none"
                        />
                        <p className="font-sans text-[10px] text-forest/35 mt-2 text-right">
                          {data.concerns.length} characters
                        </p>
                      </div>
                    )}

                    {/* Step 4 — Preferences */}
                    {step === 4 && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold text-forest mb-2">
                          Almost done!
                        </h3>
                        <p className="font-sans text-xs text-forest/50 mb-6">
                          Choose based on your financial comfort — no judgement.
                        </p>
                        <div>
                          <label className="font-sans text-xs font-medium text-forest/60 uppercase tracking-wider mb-3 block">
                            Sliding Scale Preference <span className="text-clay">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {slidingScaleOptions.map((price) => (
                              <motion.button
                                key={price}
                                type="button"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => update("slidingScale", price)}
                                className={`font-serif text-2xl font-semibold py-5 rounded-2xl border-2 transition-all duration-200 ${
                                  data.slidingScale === price
                                    ? "border-clay bg-clay/10 text-clay shadow-lg shadow-clay/10"
                                    : "border-sage/20 text-forest/50 hover:border-sage/40"
                                }`}
                              >
                                {price}
                                <span className="block font-sans text-xs font-normal mt-1 opacity-60">
                                  per session
                                </span>
                              </motion.button>
                            ))}
                          </div>
                        </div>
                        <div className="bg-forest/5 rounded-xl p-4 mt-6">
                          <p className="font-sans text-xs text-forest/50 text-center leading-relaxed">
                            🔒 All information you share will remain confidential and used only for therapeutic purposes.
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="font-sans text-xs text-red-500 text-center mt-2"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-4 border-t border-sage/15">
                {step > 0 ? (
                  <button
                    onClick={prev}
                    className="font-sans text-sm text-forest/50 hover:text-forest flex items-center gap-1 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                ) : (
                  <div />
                )}

                {step < steps.length - 1 ? (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={next}
                    className="font-sans text-sm font-medium bg-forest text-cream px-6 py-3 rounded-full flex items-center gap-2 hover:bg-forest-deep transition-colors shadow-md"
                  >
                    {step === 0 ? "Begin" : "Continue"}
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSubmit}
                    disabled={isLoading || isSuccess}
                    className="font-sans text-sm font-medium bg-clay text-cream px-6 py-3 rounded-full flex items-center gap-2 hover:bg-clay-light transition-colors shadow-md disabled:opacity-60"
                  >
                    {isSuccess ? (
                      <>
                        <Check className="w-4 h-4" /> Submitted!
                      </>
                    ) : isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Submit Form"
                    )}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Reusable Input ────────────────────────────────
function FormInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="font-sans text-xs font-medium text-forest/60 uppercase tracking-wider mb-1.5 block">
        {label} {required && <span className="text-clay">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border-2 border-sage/20 rounded-xl px-4 py-3 font-sans text-sm text-forest placeholder:text-forest/30 focus:outline-none focus:border-clay/50 transition-colors"
      />
    </div>
  );
}
