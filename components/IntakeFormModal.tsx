"use client";

import { useState, useEffect, useMemo, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Check,
  Heart,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
} from "lucide-react";

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
  studentConfirmed: boolean;
  scheduling: string;
}

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
  studentConfirmed: false,
  scheduling: "",
};

const defaultStudentNote =
  "The student rate is kept low on purpose — so someone still studying, without their own income, never has to choose between therapy and affording the month. It works because the people who can pay a little more do. If you're earning, picking a higher rate quietly keeps this slot open for someone who genuinely can't. No proof is asked for. It runs on trust.";

// An option counts as concessional when its bracketed label mentions students,
// e.g. "₹500 (Student)" — that's the only rate the honesty note applies to.
const isStudentOption = (option: string) => /\(([^)]*student[^)]*)\)/i.test(option);

export default function IntakeFormModal({
  isOpen,
  onClose,
  slidingScale: rawSlidingScale = ["₹500 (Student)", "₹800", "₹900", "₹1000"],
  calendlyUrl = "",
  studentNote = defaultStudentNote,
}: {
  isOpen: boolean;
  onClose: () => void;
  slidingScale?: string[];
  calendlyUrl?: string;
  studentNote?: string;
}) {
  // Default params only apply to `undefined`; an empty array (e.g. admin cleared
  // all options) would otherwise leave no price buttons and block submission.
  const slidingScale =
    rawSlidingScale.length > 0
      ? rawSlidingScale
      : ["₹500 (Student)", "₹800", "₹900", "₹1000"];
  const [step, setStep] = useState(0);
  const [data, setData] = useState<IntakeData>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState(1);
  const [embedSrc, setEmbedSrc] = useState("");

  // Only a real Calendly link switches the scheduling step on — a blank or
  // malformed value in the admin panel simply leaves the flow as it was.
  const schedulingEnabled = useMemo(() => {
    if (!calendlyUrl) return false;
    try {
      const url = new URL(calendlyUrl);
      return url.protocol === "https:" && /(^|\.)calendly\.com$/.test(url.hostname);
    } catch {
      return false;
    }
  }, [calendlyUrl]);

  // ─── Step definitions ─────────────────────────────
  // The scheduling step only exists once a Calendly link is configured, so the
  // rest of the flow is addressed by id rather than by a fixed index.
  const steps = useMemo(
    () => [
      { id: "intro", title: "Welcome" },
      ...(schedulingEnabled ? [{ id: "schedule", title: "Schedule" }] : []),
      { id: "personal", title: "About You" },
      { id: "contact", title: "Contact" },
      { id: "concerns", title: "Your Concerns" },
      { id: "preferences", title: "Preferences" },
    ],
    [schedulingEnabled]
  );
  const currentStep = steps[Math.min(step, steps.length - 1)].id;
  const isLastStep = step === steps.length - 1;

  // Split an option like "₹500 (Student)" into its amount and optional label
  const parseOption = (option: string) => {
    const match = option.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    return match
      ? { amount: match[1], label: match[2] }
      : { amount: option, label: null as string | null };
  };

  // Derive the headline range from the numeric values so labels never corrupt it
  const amounts = slidingScale
    .map((p) => parseInt(p.replace(/[^\d]/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const priceRange =
    amounts.length > 0
      ? `₹${Math.min(...amounts)}–₹${Math.max(...amounts)}`
      : "";

  // Cheapest non-student rate — offered as the one-tap alternative to someone
  // who realises the student rate isn't theirs to take.
  const nextRateUp = slidingScale.find((p) => !isStudentOption(p));

  // The concessional stop, if the configured scale has one.
  const studentRate = slidingScale.find(isStudentOption);

  const needsStudentConfirm =
    !!data.slidingScale && isStudentOption(data.slidingScale);

  // The slider always sits somewhere, so the form opens on the lowest paid rate
  // rather than pre-selecting the concessional one for someone.
  const defaultRate = nextRateUp ?? slidingScale[0];
  const rateIndex = Math.max(
    0,
    slidingScale.indexOf(data.slidingScale || defaultRate)
  );
  const selectedRate = parseOption(slidingScale[rateIndex]);

  // Calendly's embed needs the host domain; build it client-side only.
  useEffect(() => {
    if (!schedulingEnabled) return;
    try {
      const url = new URL(calendlyUrl);
      url.searchParams.set("embed_domain", window.location.hostname);
      url.searchParams.set("embed_type", "Inline");
      url.searchParams.set("hide_gdpr_banner", "1");
      setEmbedSrc(url.toString());
    } catch {
      setEmbedSrc("");
    }
  }, [calendlyUrl, schedulingEnabled]);

  // Calendly notifies the parent frame when a slot is actually booked, so the
  // step can mark itself done without asking the person to self-report.
  useEffect(() => {
    if (!schedulingEnabled) return;
    const onMessage = (e: MessageEvent) => {
      if (!/^https:\/\/([a-z0-9-]+\.)*calendly\.com$/.test(e.origin)) return;
      if (e.data?.event === "calendly.event_scheduled") {
        setData((d) => ({ ...d, scheduling: "booked" }));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [schedulingEnabled]);

  // The slider always displays a rate, so the displayed default is committed
  // when the step is reached — otherwise submitting would complain that nothing
  // was chosen while a value is plainly visible.
  useEffect(() => {
    if (currentStep === "preferences" && !data.slidingScale && defaultRate) {
      setData((d) => ({ ...d, slidingScale: defaultRate }));
    }
  }, [currentStep, data.slidingScale, defaultRate]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const update = (field: keyof IntakeData, value: string | boolean) => {
    setData((d) => ({ ...d, [field]: value }));
    setError("");
  };

  // Switching away from a student rate clears the confirmation, so the tick can
  // never travel with a rate it wasn't given for.
  const selectRate = (price: string) => {
    setData((d) => ({
      ...d,
      slidingScale: price,
      studentConfirmed: isStudentOption(price) ? d.studentConfirmed : false,
    }));
    setError("");
  };

  const next = () => {
    // Validate current step
    if (currentStep === "personal") {
      if (!data.name || !data.gender || !data.age) {
        setError("Please fill all fields");
        return;
      }
    } else if (currentStep === "contact") {
      if (!data.email || !data.whatsapp) {
        setError("Please fill all fields");
        return;
      }
    } else if (currentStep === "concerns") {
      if (!data.concerns) {
        setError("Please describe your concerns");
        return;
      }
    } else if (currentStep === "schedule" && !data.scheduling) {
      // Scheduling is optional — moving on simply records that it was skipped.
      update("scheduling", "skipped");
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
    if (needsStudentConfirm && !data.studentConfirmed) {
      setError("Please confirm you're currently a student, or pick another rate");
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
      if (!res.ok) {
        // The server explains precisely what it rejected — a rate limit, a
        // field that failed validation. Swallowing that leaves someone
        // retrying a form that will never go through.
        const body = await res.json().catch(() => null);
        const message =
          typeof body?.error === "string"
            ? body.error
            : "Something went wrong. Please try again, or email me directly.";
        // The reference ties this attempt to a specific line in the server log,
        // so a report of "it failed" can be traced to the check that refused it.
        throw new Error(
          body?.ref ? `${message} (ref ${body.ref})` : message
        );
      }
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setData(initialData);
        setStep(0);
        onClose();
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Please try again, or email me directly."
      );
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

  // Escape closes the dialog, matching the click-outside affordance. Rebound
  // every render so it always sees the current `handleClose`, which refuses to
  // close mid-submit.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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
            role="dialog"
            aria-modal="true"
            aria-labelledby="intake-title"
            className={`relative w-full max-h-[90vh] overflow-y-auto bg-cream rounded-3xl shadow-2xl shadow-forest/40 transition-[max-width] duration-300 ${
              currentStep === "schedule" ? "max-w-2xl" : "max-w-lg"
            }`}
          >
            {/* Names the dialog for screen readers on every step — the visible
                headings change as the flow advances. */}
            <h2 id="intake-title" className="sr-only">
              Therapy intake form
            </h2>

            {/* Close button */}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close form"
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
                    {/* Intro */}
                    {currentStep === "intro" && (
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
                            💫 Sliding scale {priceRange} &nbsp;·&nbsp;
                            🔒 All information remains confidential
                          </p>
                        </div>
                        <p className="font-sans text-xs text-forest/40 text-center italic">
                          This form helps me understand your needs and check availability.
                        </p>
                      </div>
                    )}

                    {/* Schedule — optional, only when a Calendly link is set */}
                    {currentStep === "schedule" && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold text-forest mb-2">
                          Want to pick a time first?
                        </h3>
                        <p className="font-sans text-xs text-forest/50 mb-5">
                          Entirely optional. Book a slot now if you already know what
                          suits you — or skip this and we&apos;ll find a time together
                          over WhatsApp after I read your form.
                        </p>

                        {data.scheduling === "booked" ? (
                          <div className="bg-forest/5 rounded-2xl p-8 text-center">
                            <div className="w-12 h-12 bg-forest rounded-full flex items-center justify-center mx-auto mb-4">
                              <Check className="w-6 h-6 text-cream" />
                            </div>
                            <p className="font-serif text-lg font-semibold text-forest mb-1">
                              Slot booked
                            </p>
                            <p className="font-sans text-xs text-forest/50">
                              You&apos;ll get a calendar invite by email. Continue with
                              the form so I know what to prepare for.
                            </p>
                          </div>
                        ) : embedSrc ? (
                          <div className="rounded-2xl overflow-hidden border-2 border-sage/20 bg-white">
                            <iframe
                              src={embedSrc}
                              title="Schedule a session"
                              className="w-full h-[420px] border-0"
                            />
                          </div>
                        ) : (
                          <div className="bg-forest/5 rounded-2xl p-8 text-center">
                            <CalendarDays className="w-8 h-8 text-forest/40 mx-auto mb-3" />
                            <p className="font-sans text-xs text-forest/50">
                              Scheduling is unavailable right now — carry on with the
                              form and I&apos;ll reach out to fix a time.
                            </p>
                          </div>
                        )}

                        {data.scheduling !== "booked" && embedSrc && (
                          <button
                            type="button"
                            onClick={() => {
                              update("scheduling", "booked");
                            }}
                            className="font-sans text-xs text-forest/45 hover:text-forest underline underline-offset-2 mt-3 mx-auto block transition-colors"
                          >
                            I&apos;ve already booked a slot
                          </button>
                        )}
                      </div>
                    )}

                    {/* Personal */}
                    {currentStep === "personal" && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold text-forest mb-6">
                          Tell me about yourself
                        </h3>
                        <div className="space-y-4">
                          <FormInput
                            label="Full Name"
                            value={data.name}
                            onChange={(v) => update("name", v)}
                            autoComplete="name"
                            required
                          />
                          <div role="group" aria-labelledby="intake-gender-label">
                            <span
                              id="intake-gender-label"
                              className="font-sans text-xs font-medium text-forest/60 uppercase tracking-wider mb-2 block"
                            >
                              Gender <span className="text-clay">*</span>
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              {genderOptions.map((g) => (
                                <button
                                  key={g}
                                  type="button"
                                  aria-pressed={data.gender === g}
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
                            inputMode="numeric"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* Contact */}
                    {currentStep === "contact" && (
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
                            autoComplete="email"
                            inputMode="email"
                            required
                          />
                          <FormInput
                            label="WhatsApp Number"
                            value={data.whatsapp}
                            onChange={(v) => update("whatsapp", v)}
                            type="tel"
                            autoComplete="tel"
                            inputMode="tel"
                            required
                          />
                          <FormInput
                            label="Education & Occupation"
                            value={data.education}
                            onChange={(v) => update("education", v)}
                          />
                          <div role="group" aria-labelledby="intake-language-label">
                            <span
                              id="intake-language-label"
                              className="font-sans text-xs font-medium text-forest/60 uppercase tracking-wider mb-2 block"
                            >
                              Preferred Language
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {languageOptions.map((l) => (
                                <button
                                  key={l}
                                  type="button"
                                  aria-pressed={data.preferredLanguage === l}
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

                    {/* Concerns */}
                    {currentStep === "concerns" && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold text-forest mb-2">
                          What brings you to therapy?
                        </h3>
                        <p className="font-sans text-xs text-forest/50 mb-6">
                          Please briefly describe your concerns (e.g., stress, anxiety, relationship issues, low mood, self-esteem, etc.)
                        </p>
                        <label
                          htmlFor="intake-concerns"
                          className="font-sans text-xs font-medium text-forest/60 uppercase tracking-wider mb-1.5 block"
                        >
                          Your Concerns <span className="text-clay">*</span>
                        </label>
                        <textarea
                          id="intake-concerns"
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

                    {/* Preferences */}
                    {currentStep === "preferences" && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold text-forest mb-2">
                          Almost done!
                        </h3>
                        <p className="font-sans text-xs text-forest/50 mb-6">
                          Slide to whatever you can genuinely manage — no judgement, and no proof asked for.
                        </p>
                        <div role="group" aria-labelledby="intake-rate-label">
                          <span
                            id="intake-rate-label"
                            className="font-sans text-xs font-medium text-forest/60 uppercase tracking-wider mb-3 block"
                          >
                            Sliding scale — choose your rate <span className="text-clay">*</span>
                          </span>
                          {/* A real slider, because "sliding scale" should
                              slide. Discrete stops keep it to the rates that
                              are actually configured. */}
                          <div className="px-1">
                            <div className="text-center mb-5">
                              <motion.p
                                key={selectedRate.amount}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.18 }}
                                className="font-serif text-4xl font-semibold text-clay"
                              >
                                {selectedRate.amount}
                              </motion.p>
                              <p className="font-sans text-xs text-forest/50 mt-1">
                                {selectedRate.label ?? "per session"}
                              </p>
                            </div>

                            <input
                              type="range"
                              min={0}
                              max={slidingScale.length - 1}
                              step={1}
                              value={rateIndex}
                              onChange={(e) =>
                                selectRate(slidingScale[Number(e.target.value)])
                              }
                              aria-label="Session rate"
                              style={
                                {
                                  "--rate-pct": `${
                                    slidingScale.length > 1
                                      ? (rateIndex / (slidingScale.length - 1)) * 100
                                      : 100
                                  }%`,
                                } as React.CSSProperties
                              }
                              aria-valuetext={`${selectedRate.amount}${
                                selectedRate.label ? `, ${selectedRate.label}` : ""
                              }`}
                              className="rate-slider w-full"
                            />

                            {/* Each stop carries its own label, so the student
                                rate identifies itself before anyone slides onto
                                it rather than after. */}
                            <div className="flex justify-between items-start mt-3 gap-1">
                              {slidingScale.map((price, i) => {
                                const { amount, label } = parseOption(price);
                                return (
                                  <button
                                    key={price}
                                    type="button"
                                    onClick={() => selectRate(price)}
                                    className={`flex flex-col items-center leading-tight transition-colors ${
                                      i === rateIndex
                                        ? "text-clay"
                                        : "text-forest/35 hover:text-forest/60"
                                    }`}
                                  >
                                    <span
                                      className={`font-sans text-[11px] ${
                                        i === rateIndex ? "font-medium" : ""
                                      }`}
                                    >
                                      {amount}
                                    </span>
                                    {label && (
                                      <span
                                        className={`font-sans text-[10px] mt-0.5 ${
                                          i === rateIndex
                                            ? "text-clay/80"
                                            : "text-clay/50"
                                        }`}
                                      >
                                        {label}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {studentRate && !needsStudentConfirm && (
                              <p className="font-sans text-[11px] text-forest/45 leading-relaxed text-center mt-4">
                                {parseOption(studentRate).amount} is held for
                                students without their own income — you&apos;ll be
                                asked to confirm if you slide there.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Student rate — one honest note, one tick. Only ever
                            shown to the person actually taking that rate. */}
                        <AnimatePresence initial={false}>
                          {needsStudentConfirm && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-clay/5 border-2 border-clay/20 rounded-2xl p-5 mt-5">
                                <p className="font-serif text-sm font-semibold text-forest mb-2">
                                  Why the student rate exists
                                </p>
                                <p className="font-sans text-xs text-forest/60 leading-relaxed mb-4">
                                  {studentNote}
                                </p>

                                <label className="flex items-start gap-3 cursor-pointer group">
                                  <span
                                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                      data.studentConfirmed
                                        ? "bg-clay border-clay"
                                        : "border-sage/40 group-hover:border-clay/50"
                                    }`}
                                  >
                                    {data.studentConfirmed && (
                                      <Check className="w-3.5 h-3.5 text-cream" />
                                    )}
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={data.studentConfirmed}
                                    onChange={(e) =>
                                      update("studentConfirmed", e.target.checked)
                                    }
                                    className="sr-only"
                                  />
                                  <span className="font-sans text-xs text-forest/70 leading-relaxed">
                                    Yes — I&apos;m currently a student without an
                                    independent income.
                                  </span>
                                </label>

                                {nextRateUp && (
                                  <button
                                    type="button"
                                    onClick={() => selectRate(nextRateUp)}
                                    className="font-sans text-xs text-forest/45 hover:text-forest underline underline-offset-2 mt-3 transition-colors"
                                  >
                                    Actually, I can pay {parseOption(nextRateUp).amount}
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

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

                {!isLastStep ? (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={next}
                    className="font-sans text-sm font-medium bg-forest text-cream px-6 py-3 rounded-full flex items-center gap-2 hover:bg-forest-deep transition-colors shadow-md"
                  >
                    {currentStep === "intro"
                      ? "Begin"
                      : currentStep === "schedule" && data.scheduling !== "booked"
                        ? "Skip for now"
                        : "Continue"}
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
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
}) {
  // Tying the label to the input keeps screen readers and browser autofill able
  // to name the field — the visual label alone doesn't.
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="font-sans text-xs font-medium text-forest/60 uppercase tracking-wider mb-1.5 block"
      >
        {label} {required && <span className="text-clay">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border-2 border-sage/20 rounded-xl px-4 py-3 font-sans text-sm text-forest placeholder:text-forest/30 focus:outline-none focus:border-clay/50 transition-colors"
      />
    </div>
  );
}
