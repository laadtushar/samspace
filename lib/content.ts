import {
  readConfidentialJson,
  readPublicJson,
  writeConfidentialJson,
  writePublicJson,
  listBlobs,
  deleteBlob,
} from "@/lib/blob";

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
    phone: string;
    whatsappLink: string;
  };
  slidingScale: string[];
  /** Calendly scheduling link. Empty string hides the optional scheduling step. */
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
        price: "₹500–₹1000",
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
          "Sessions run on a sliding scale of ₹500–₹1000. You choose the rate that matches your financial situation — there's no judgement either way. The ₹500 rate is reserved for students without an independent income, and it's funded by the people who choose to pay more.",
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
    phone: "+91 91307 43144",
    whatsappLink:
      "https://wa.me/919130743144?text=Hi%20Priyanka%2C%20I%27d%20like%20to%20book%20a%20session%20at%20Samvriti.Space.",
  },
  slidingScale: ["₹500 (Student)", "₹800", "₹900", "₹1000"],
  calendlyUrl: "",
  studentNote:
    "The student rate is kept low on purpose — so someone still studying, without their own income, never has to choose between therapy and affording the month. It works because the people who can pay a little more do. If you're earning, picking a higher rate quietly keeps this slot open for someone who genuinely can't. No proof is asked for. It runs on trust.",
};

// ─── Intake Form Submission Schema ─────────────────
export interface IntakeSubmission {
  id: string;
  timestamp: string;
  name: string;
  email: string;
  gender: string;
  age: string;
  whatsapp: string;
  education: string;
  preferredLanguage: string;
  concerns: string;
  slidingScale: string;
  /** Ticked only when a student-labelled rate was chosen. */
  studentConfirmed?: boolean;
  /** "booked" | "skipped" | "" (scheduling step not shown) */
  scheduling?: string;
}

// ─── Blob keys ─────────────────────────────────────
const CONTENT_KEY = "site-content.json";
/** Each submission is its own private blob under this prefix. */
const SUBMISSIONS_PREFIX = "submissions/";
/**
 * The single public JSON that every submission used to be appended to. Still
 * read so existing records stay visible until they are migrated off it.
 */
const LEGACY_SUBMISSIONS_KEY = "intake-submissions.json";

// ─── Site content ──────────────────────────────────

/**
 * Merges stored content over the defaults one level into each section, so a
 * partially-saved section (or a newly added field) falls back to its default
 * instead of rendering `undefined` on the live site.
 */
function mergeContent(stored: unknown): SiteContent {
  if (!stored || typeof stored !== "object") return defaultContent;
  const isPlainObject = (v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  const defaults: Record<string, unknown> = { ...defaultContent };
  const merged: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    // Unknown keys are dropped rather than merged, so a stale or hand-edited
    // blob cannot introduce fields the site never asked for.
    if (!(key in defaults)) continue;
    const fallback = defaults[key];
    merged[key] =
      isPlainObject(fallback) && isPlainObject(value)
        ? { ...(fallback as object), ...(value as object) }
        : value;
  }
  return merged as unknown as SiteContent;
}

export async function getContent(): Promise<SiteContent> {
  const stored = await readPublicJson<unknown>(CONTENT_KEY, null);
  return mergeContent(stored);
}

export async function saveContent(content: SiteContent): Promise<void> {
  await writePublicJson(CONTENT_KEY, content);
}

// ─── Intake submissions ────────────────────────────

/**
 * One blob per submission. The previous design appended to a single JSON
 * document, so two people submitting at once could overwrite each other, and a
 * transient read failure could replace the whole history with one record. A
 * write that only ever creates its own object cannot lose anyone else's.
 *
 * The timestamp leads the pathname, so the listing sorts newest-first without
 * opening a single file.
 */
function submissionPath(submission: IntakeSubmission): string {
  return `${SUBMISSIONS_PREFIX}${submission.timestamp}-${submission.id}.json`;
}

export async function addSubmission(
  submission: IntakeSubmission
): Promise<void> {
  await writeConfidentialJson(submissionPath(submission), submission);
}

/** Runs `fn` over items with a bounded number of blob requests in flight. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

export async function getSubmissions(): Promise<IntakeSubmission[]> {
  const [perBlob, legacy] = await Promise.all([
    listBlobs(SUBMISSIONS_PREFIX).then((blobs) =>
      mapWithConcurrency(
        blobs.map((b) => b.pathname),
        8,
        (pathname) => readConfidentialJson<IntakeSubmission | null>(pathname, null)
      )
    ),
    readLegacySubmissions(),
  ]);

  return [...perBlob.filter((s): s is IntakeSubmission => s !== null), ...legacy].sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp)
  );
}

/** The original single document, still plaintext until the migration runs. */
async function readLegacySubmissions(): Promise<IntakeSubmission[]> {
  return (
    (await readConfidentialJson<IntakeSubmission[] | null>(
      LEGACY_SUBMISSIONS_KEY,
      null
    ).catch(() => null)) ?? []
  );
}

/**
 * Moves any records still in the single legacy blob into per-submission private
 * blobs, then deletes the legacy blob. Safe to run more than once.
 *
 * Note for whoever runs this: the legacy blob was plaintext in a public store,
 * so reading it required no credentials. Treat its contents as disclosed.
 */
export async function migrateLegacySubmissions(): Promise<{
  migrated: number;
}> {
  const legacy = await readLegacySubmissions();
  if (legacy.length === 0) return { migrated: 0 };

  for (const submission of legacy) {
    await writeConfidentialJson(submissionPath(submission), submission);
  }
  await deleteBlob(LEGACY_SUBMISSIONS_KEY);

  return { migrated: legacy.length };
}
