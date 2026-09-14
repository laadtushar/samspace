import { unstable_cache, revalidateTag } from "next/cache";
import { fillDeep, rateValues } from "@/lib/tokens";
import { safeWhatsappLink } from "@/lib/whatsapp";
import { BUILD_ID } from "@/lib/build-id";
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
  slidingScale: ["₹500 (Student)", "₹800", "₹900", "₹1000"],
  calendlyUrl: "",
  studentNote:
    "The student rate is kept low on purpose — so someone still studying, without their own income, never has to choose between therapy and affording the month. It works because the people who can pay a little more do. If you're earning, picking a higher rate quietly keeps this slot open for someone who genuinely can't. No proof is asked for. It runs on trust.",
};

/**
 * Site content with the private contact details removed.
 *
 * Anything handed to a client component is serialised into the page, so
 * passing the whole content object put the phone number and the wa.me link
 * into the HTML whether or not either was rendered — which is exactly what
 * address harvesters read. The public pages get this shape instead, and the
 * The practitioner's own phone number never reaches the browser. The WhatsApp
 * link does, because it names a handle rather than a number.
 */
export type PublicSiteContent = Omit<SiteContent, "contact"> & {
  contact: Omit<SiteContent["contact"], "phone">;
};

export function toPublicContent(content: SiteContent): PublicSiteContent {
  const { phone: _phone, ...contact } = content.contact;
  return { ...content, contact };
}

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
/**
 * Stored content over the shipped defaults, one level deep.
 *
 * Exported for the tests, which pin the property the rest of the site leans on:
 * a key the stored document has never seen is served from the defaults. That is
 * how copy added after the dashboard was first used reaches the live site at
 * all — without it, every new field would render empty until someone retyped it
 * into Settings.
 */
export function mergeContent(stored: unknown): SiteContent {
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

  /*
    Validating a WhatsApp link on the way in is not enough, and assuming it was
    put the practitioner's phone number back on the live site.

    The schema runs when content is saved. A document stored before the rule
    existed still holds wa.me/<number>, and because contact is merged one level
    deep that value survives untouched — so removing the field from the schema
    and then serving it publicly meant the number went straight into an href.

    Storage is the untrusted side of this boundary: anything already in it
    predates whatever rule is current. So the same check runs on the way out,
    where a stored number becomes "" and the contact card simply does not
    render.
  */
  const contact = merged.contact as SiteContent["contact"] | undefined;
  if (contact) {
    merged.contact = {
      ...contact,
      whatsappLink: safeWhatsappLink(contact.whatsappLink),
    };
  }

  return merged as unknown as SiteContent;
}

export async function getContent(): Promise<SiteContent> {
  const stored = await readPublicJson<unknown>(CONTENT_KEY, null);
  return mergeContent(stored);
}

export const CONTENT_TAG = "site-content";

/**
 * The same read, but billed once an hour instead of once per regeneration.
 *
 * Blob is metered per request, and every public page reads content. With the
 * homepage revalidating each minute that is ~1,400 reads a day from one route,
 * against a free tier of 10,000 a month — which is how the account reached 75%
 * of it in a fortnight.
 *
 * Caching on a timer alone would mean an edit taking up to an hour to show, so
 * saving busts the tag: the dashboard stays instant and the meter stays still.
 *
 * The admin dashboard deliberately keeps using getContent — it must always see
 * what is actually stored, not what was stored an hour ago.
 */
/**
 * Content with pricing tokens filled in, for the public site.
 *
 * Copy can say {{rate.range}} instead of typing the figure out, so a rate lives
 * in the rates list and nowhere else. Resolving here means every public
 * consumer gets it without knowing about tokens at all — the page, the FAQ
 * structured data, the share descriptions, the /start page.
 *
 * Deliberately not in getContent: the dashboard must see {{rate.range}} to edit
 * it. Resolving before it got there would replace the token with today's number
 * and quietly undo the arrangement the first time a FAQ answer was saved.
 */
export function resolveContentTokens(content: SiteContent): SiteContent {
  return fillDeep(content, rateValues(content.slidingScale));
}

export const getCachedContent = unstable_cache(
  async () => resolveContentTokens(await getContent()),
  // Scoped to the build: a deployment that adds a field must not keep serving
  // an object shaped by the previous one.
  [CONTENT_TAG, BUILD_ID],
  { tags: [CONTENT_TAG], revalidate: 3600 }
);

export async function saveContent(content: SiteContent): Promise<void> {
  await writePublicJson(CONTENT_KEY, content);
  bustCache(CONTENT_TAG);
}

/**
 * Clears a cache tag without letting that failure undo a successful write.
 *
 * revalidateTag throws outside a request context — a script, a test, a future
 * background job — and losing a saved edit because the cache could not be
 * cleared would be the wrong trade every time. The tag expires on its own
 * within the hour.
 */
export function bustCache(tag: string): void {
  try {
    revalidateTag(tag);
  } catch {
    // Saved either way.
  }
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
 * Removes one submission, wherever it lives.
 *
 * Records written since the per-submission change are their own object and are
 * simply deleted. Anything still inside the original combined document has to
 * be rewritten without it — which is a read-modify-write, and is only safe here
 * because that document is frozen: nothing appends to it any more.
 *
 * Returns false when no record with that id exists, so the caller can answer
 * honestly rather than reporting a delete that never happened.
 */
export async function deleteSubmission(id: string): Promise<boolean> {
  const blobs = await listBlobs(SUBMISSIONS_PREFIX);
  const match = blobs.find((b) => b.pathname.includes(id));
  if (match) {
    await deleteBlob(match.pathname);
    return true;
  }

  const legacy = await readLegacySubmissions();
  const remaining = legacy.filter((s) => s.id !== id);
  if (remaining.length === legacy.length) return false;

  await writeConfidentialJson(LEGACY_SUBMISSIONS_KEY, remaining);
  return true;
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
