import { DEFAULT_SLIDING_SCALE } from "@/lib/rates";

/**
 * The shape of the site's copy, and the copy it ships with.
 *
 * Data only, and importing it pulls in nothing else. The dashboard is a client
 * component, so it cannot import the module that reads and writes content — that
 * would put the storage client, and with it `fs` and `net`, into the browser
 * bundle. It needs the built-in wording all the same: to show what a field said
 * before it was edited, and to put it back.
 *
 * `lib/content` re-exports both, so server code carries on importing one module.
 */

// ─── Site Content Schema ──────────────────────────
export interface SiteContent {
  hero: {
    headline: string;
    subtext: string;
    quoteText: string;
  };
  about: {
    heading: string;
    paragraph: string;
    features: { icon: string; title: string; desc: string }[];
  };
  services: {
    items: {
      title: string;
      price: string | null;
      unit: string | null;
      tags: string[];
    }[];
  };
  issues: {
    heading: string;
    intro: string;
    items: string[];
  };
  mentoring: {
    heading: string;
    subtext: string;
    card1Title: string;
    card1Items: string[];
    card2Title: string;
    card2Items: string[];
  };
  faq: {
    heading: string;
    intro: string;
    items: { question: string; answer: string }[];
  };
  contact: {
    heading: string;
    subtext: string;
    email: string;
    /**
     * Never served to the public site — toPublicContent strips it. Kept so the
     * practitioner has her own number on the record somewhere she controls.
     */
    phone: string;
    /**
     * A WhatsApp username or Business short link — never a wa.me/<number>,
     * which the schema refuses. Safe to put in an href, so it is served.
     */
    whatsappLink: string;
  };
  social: {
    instagram: string;
    linkedin: string;
  };
  /** The /start page — the one link that goes in an Instagram bio. */
  startPage: {
    heading: string;
    subtext: string;
    links: { label: string; description: string; href: string }[];
  };
  /**
   * The intake form's opening screen.
   *
   * This was written into the component, which meant the one screen standing
   * between a visitor and booking could not be changed without a deployment.
   * The assurances can use pricing tokens, so the rate is not typed here either.
   */
  intakeForm: {
    heading: string;
    intro: string;
    assurances: string[];
    footnote: string;
  };
  /**
   * What a first session actually looks like.
   *
   * A new top-level key, which matters: `mergeContent` spreads the defaults
   * underneath stored content, so a key stored content has never seen is served
   * from here. That is the only way copy added after the dashboard was first
   * used reaches the live site without being retyped there.
   */
  sessionStructure: {
    heading: string;
    intro: string;
    steps: { title: string; desc: string }[];
  };
  slidingScale: string[];
  /**
   * Booking link — Calendly or Cal ID. Empty string hides the scheduling step.
   * Named for Calendly because it was Calendly-only first, and the key is what
   * stored content is already keyed by.
   */
  calendlyUrl: string;
  /** Honest note shown when someone picks a student-labelled rate. */
  studentNote: string;
}

// ─── Defaults ──────────────────────────────────────
export const defaultContent: SiteContent = {
  hero: {
    headline: "A space to feel seen, heard, and supported.",
    subtext:
      "Online therapy and academic mentoring for young adults navigating life's most challenging transitions.",
    quoteText:
      "You don't have to navigate this alone. Healing begins with one honest conversation.",
  },
  about: {
    heading: "Qualified. Compassionate. Evidence-based.",
    paragraph:
      "I'm Priyanka Varma — a Lecturer, UGC NET-JRF & GATE-qualified psychologist with a Master's in Clinical Psychology, working under the banner of Samvriti.Space. I work with young adults experiencing emotional distress, academic stress, and personal growth challenges using an eclectic approach drawing from CBT, Humanistic Therapy, and Trauma-Informed Care — tailored to your unique needs and comfort.",
    features: [
      {
        icon: "🌿",
        title: "Eclectic Approach",
        desc: "CBT, Humanistic Therapy, Trauma-Informed Care",
      },
      {
        icon: "🛡️",
        title: "Safe & Ethical",
        desc: "Sessions under professional supervision, strict confidentiality",
      },
      {
        icon: "🌱",
        title: "Growth-Focused",
        desc: "Building insight, emotional regulation, healthier coping strategies",
      },
    ],
  },
  services: {
    items: [
      {
        title: "Therapy Sessions",
        // The scale, not a copy of it — see the token note above slidingScale.
        price: "{{rate.range}}",
        unit: "/session",
        tags: ["CBT", "Humanistic", "Trauma-Informed", "Online"],
      },
      {
        title: "Academic Mentoring",
        price: "₹1000",
        unit: "/session",
        tags: ["Career Guidance", "Psychology Students", "11th–12th Grade"],
      },
      {
        title: "Session Structure",
        price: null,
        unit: null,
        tags: ["45–50 mins", "Online Only", "Supervised", "Confidential"],
      },
    ],
  },
  issues: {
    heading: "What we can work through together",
    intro:
      "These are some of the common concerns I work with. If your experience isn't listed here, reach out — we can discuss whether my approach is the right fit for you.",
    items: [
      "Academic stress & burnout",
      "Anxiety & overthinking",
      "Low self-esteem & self-doubt",
      "Emotional overwhelm",
      "Relationship concerns & boundaries",
      "Adjustment issues",
      "Guilt, shame & identity concerns",
      "Stress from exams or life transitions",
    ],
  },
  mentoring: {
    heading: "Clarity for your psychology journey.",
    subtext:
      "Evidence-informed mentorship — not therapy — focused on academic direction, exam strategy, and career clarity in psychology.",
    card1Title: "For 11th & 12th Students",
    card1Items: [
      "Exploring career options (psychology & beyond)",
      "Understanding streams, courses & entrance exams",
      "Clarifying interests, strengths & suitability",
      "Reducing confusion, comparison & pressure",
      "Parental expectation stress (discussion & planning)",
      "Building realistic short-term academic goals",
    ],
    card2Title: "For Psychology Students (BA/BSc/MA)",
    card2Items: [
      "Career options after BA / MA Psychology",
      "NET-JRF & GATE preparation strategy",
      "Study planning & time management",
      "Managing academic stress & burnout",
      "Research & higher education guidance",
    ],
  },
  faq: {
    heading: "Questions people usually ask first",
    intro:
      "If something you're wondering about isn't here, ask me directly — no question is too small to bring.",
    items: [
      {
        question: "What type of therapy do you offer?",
        answer:
          "I work eclectically, drawing on CBT, Humanistic Therapy, Trauma-Informed Care, and mindfulness-based practices. Rather than fitting you to one method, I adapt the approach to what you're bringing and what you're comfortable with.",
      },
      {
        question: "How much does a session cost?",
        answer:
          "Sessions run on a sliding scale of {{rate.range}}. If you're earning, you choose anywhere in {{rate.band}} — whichever rate matches your financial situation, and there's no judgement either way. The {{rate.student}} rate is reserved for students without an independent income, and it's funded by the people who choose to pay more.",
      },
      {
        question: "Are sessions online?",
        answer:
          "Yes — all therapy and mentoring sessions are held online. Each session runs 45–50 minutes and is fully confidential.",
      },
      {
        question: "What are your qualifications?",
        answer:
          "I hold a Master's in Clinical Psychology and am UGC NET-JRF and GATE qualified. I practise under professional supervision, which means my work is reviewed by a senior clinician — a safeguard for you.",
      },
      {
        question: "What happens after I fill the intake form?",
        answer:
          "I read it personally and reach out within 24–48 hours to talk about next steps and find a time. If scheduling is open, you can also book a slot directly while filling the form.",
      },
      {
        question: "Is what I share confidential?",
        answer:
          "Yes. What you share stays between us, and is used only for your therapeutic care. The limits to this are the standard ones — situations where there's a serious risk of harm to you or someone else.",
      },
    ],
  },
  contact: {
    heading: "Ready to take the first step?",
    subtext: "Reach out to schedule your session. I'll respond within 24 hours.",
    email: "Priyankavarma785@gmail.com",
    phone: "",
    whatsappLink: "",
  },
  social: {
    instagram: "https://www.instagram.com/samvriti.space",
    linkedin: "https://www.linkedin.com/in/priyanka-varma-322363216",
  },
  startPage: {
    heading: "Start here",
    subtext:
      "Whatever brought you here — booking a session, reading something first, or just asking a question — this is where to begin.",
    links: [
      {
        label: "Book a therapy session",
        description: "Fill the intake form — takes about three minutes",
        href: "/?intake=true",
      },
      {
        label: "Read the writing",
        description: "Notes on anxiety, academic pressure and boundaries",
        href: "/blog",
      },
      {
        label: "About me and how I work",
        description: "Qualifications, approach, and what sessions cost",
        href: "/#about",
      },
    ],
  },
  intakeForm: {
    heading: "Therapy Intake Form",
    intro:
      "I'm Priyanka Varma, a psychologist working under supervision with a master's degree in clinical psychology. I use an eclectic and personalised approach integrating CBT, Humanistic, Trauma-Informed Care, and mindfulness-based practices.",
    // {{rate.range}} rather than the figure, so the rates list stays the only
    // place a price is typed.
    assurances: [
      "🌿 Sessions are conducted online",
      "💫 Sliding scale {{rate.range}}",
      "🔒 All information remains confidential",
    ],
    footnote: "This form helps me understand your needs and check availability.",
  },
  sessionStructure: {
    heading: "What actually happens in a first session",
    intro:
      "Most people are nervous before a first session, including people who have done this before. That is usually not a sign anything is wrong — it is what it feels like to talk to someone new about things that matter. Here is the hour, so it is one less unknown.",
    steps: [
      {
        title: "Before we start",
        desc: "You will have filled in the intake form. It is not a test you can get wrong — it exists so the first session does not start from zero.",
      },
      {
        title: "The first ten minutes",
        desc: "Orientation, not your deepest trauma. How confidentiality works and where its limits are, how long and how often we meet, and room for anything you want to ask before getting into anything personal.",
      },
      {
        title: "The middle",
        desc: "A conversation rather than a monologue you have to deliver well. Start wherever feels most pressing — you do not need the right words, or to begin at the beginning.",
      },
      {
        title: "Toward the end",
        desc: "A loose plan for what to focus on next and how often to meet. Not a fixed number of sessions, and not a commitment you are locked into.",
      },
    ],
  },
  /*
    The only place a therapy rate is typed. Copy elsewhere says {{rate.range}},
    {{rate.band}} or {{rate.student}} and is filled in from here on the way out
    to the public site, so a price cannot be changed in one place and left
    behind in another.
  */
  slidingScale: [...DEFAULT_SLIDING_SCALE],
  calendlyUrl: "",
  studentNote:
    "The student rate is kept low on purpose — so someone still studying, without their own income, never has to choose between therapy and affording the month. It works because the people who can pay a little more do. If you're earning, picking a higher rate quietly keeps this slot open for someone who genuinely can't. No proof is asked for. It runs on trust.",
};
