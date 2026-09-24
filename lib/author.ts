import { SITE_URL } from "@/lib/site";
import type { SiteContent } from "@/lib/content";

/**
 * Who writes the site, in one place.
 *
 * Google gives "even more weight" to signs of expertise on health topics and
 * "strongly encourage[s]" visible bylines with author background
 * (developers.google.com/search/docs/fundamentals/creating-helpful-content).
 * So the byline on every post, the author page it links to, and the Person in
 * the site-wide structured data all read from here and cannot drift apart.
 */
export const AUTHOR = {
  id: `${SITE_URL}#priyanka`,
  name: "Priyanka Varma",
  /** The author page every byline links to. */
  path: "/about",
  jobTitle: "Counselling Psychologist & Academic Mentor",
  summary:
    "M.Sc. Clinical Psychology, UGC NET-JRF & GATE Qualified. Lecturer and counselling psychologist specialising in the mental health of young adults aged 18–35.",
  image: "/priyanka.jpeg",
  credentials: ["M.Sc. Clinical Psychology", "UGC NET-JRF", "GATE (Psychology)"],
  knowsAbout: [
    "Cognitive Behavioral Therapy",
    "Humanistic Therapy",
    "Trauma-Informed Care",
    "Academic Mentoring",
    "Young Adult Mental Health",
  ],
  languages: ["en", "hi"],
} as const;

export const AUTHOR_URL = `${SITE_URL}${AUTHOR.path}`;

/** The schema.org Person, shared by the site graph and the author page. */
export function authorPerson(content: Pick<SiteContent, "social" | "contact">) {
  return {
    "@type": "Person",
    "@id": AUTHOR.id,
    name: AUTHOR.name,
    sameAs: [content.social.linkedin, content.social.instagram].filter(Boolean),
    jobTitle: AUTHOR.jobTitle,
    description: AUTHOR.summary,
    url: AUTHOR_URL,
    image: `${SITE_URL}${AUTHOR.image}`,
    email: content.contact.email,
    knowsLanguage: [...AUTHOR.languages],
    worksFor: { "@id": `${SITE_URL}#business` },
    hasCredential: AUTHOR.credentials.map((credentialCategory) => ({
      "@type": "EducationalOccupationalCredential",
      credentialCategory,
    })),
    knowsAbout: [...AUTHOR.knowsAbout],
  };
}
