import { put, head } from "@vercel/blob";

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
  contact: {
    heading: string;
    subtext: string;
    email: string;
    phone: string;
    whatsappLink: string;
  };
  slidingScale: string[];
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
        price: "₹500–₹800",
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
  contact: {
    heading: "Ready to take the first step?",
    subtext: "Reach out to schedule your session. I'll respond within 24 hours.",
    email: "Priyankavarma785@gmail.com",
    phone: "+91 91307 43144",
    whatsappLink:
      "https://wa.me/919130743144?text=Hi%20Priyanka%2C%20I%27d%20like%20to%20book%20a%20session%20at%20Samvriti.Space.",
  },
  slidingScale: ["₹500", "₹600", "₹700", "₹800"],
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
}

// ─── Blob helpers ──────────────────────────────────
const CONTENT_KEY = "site-content.json";
const SUBMISSIONS_KEY = "intake-submissions.json";

export async function getContent(): Promise<SiteContent> {
  try {
    const blob = await head(CONTENT_KEY);
    if (blob) {
      const res = await fetch(blob.url);
      return { ...defaultContent, ...(await res.json()) };
    }
  } catch {
    // blob doesn't exist yet
  }
  return defaultContent;
}

export async function saveContent(content: SiteContent): Promise<void> {
  await put(CONTENT_KEY, JSON.stringify(content), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function getSubmissions(): Promise<IntakeSubmission[]> {
  try {
    const blob = await head(SUBMISSIONS_KEY);
    if (blob) {
      const res = await fetch(blob.url);
      return await res.json();
    }
  } catch {
    // no submissions yet
  }
  return [];
}

export async function addSubmission(
  submission: IntakeSubmission
): Promise<void> {
  const existing = await getSubmissions();
  existing.unshift(submission);
  await put(SUBMISSIONS_KEY, JSON.stringify(existing), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
