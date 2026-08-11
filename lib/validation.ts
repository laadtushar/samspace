import { z } from "zod";

/**
 * Server-side schemas for everything that arrives over HTTP.
 *
 * The client-side checks in the form components are a convenience for the
 * person filling it in — the API is directly reachable, so every constraint
 * that matters is restated here. Length caps in particular are load-bearing:
 * without them a script can push arbitrarily large payloads into storage.
 */

const trimmed = (max: number) => z.string().trim().max(max);

export const intakeSchema = z.object({
  name: trimmed(120).min(1, "Name is required"),
  email: trimmed(254).email("A valid email address is required"),
  gender: trimmed(40).min(1, "Gender is required"),
  age: trimmed(3)
    .regex(/^\d{1,3}$/, "Age must be a number")
    .refine((v) => Number(v) >= 13 && Number(v) <= 120, "Age must be between 13 and 120"),
  whatsapp: trimmed(20).regex(
    /^[\d+\-\s()]{7,20}$/,
    "A valid phone number is required"
  ),
  education: trimmed(200).optional().default(""),
  preferredLanguage: trimmed(60).optional().default(""),
  concerns: trimmed(5000).min(1, "Please describe your concerns"),
  slidingScale: trimmed(60).min(1, "Please select a rate"),
  studentConfirmed: z.boolean().optional().default(false),
  scheduling: z.enum(["booked", "skipped", ""]).optional().default(""),
});

export const contactSchema = z.object({
  name: trimmed(120).min(1, "Name is required"),
  email: trimmed(254).email("A valid email address is required"),
  message: trimmed(5000).min(1, "Message is required"),
});

// ─── Site content ──────────────────────────────────

/**
 * React does not sanitise `href`, so a stored `javascript:` URL would execute
 * for every visitor who clicks the contact card. Links that reach the public
 * site are checked against an allowlist on the way in and rendered as an empty
 * string if they fail — the components already treat that as "no link".
 */
export function safeExternalUrl(
  value: unknown,
  allowedHosts?: string[]
): string {
  if (typeof value !== "string" || value.trim() === "") return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return "";
    if (allowedHosts && !allowedHosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Profile links, with share-tracking removed.
 *
 * Instagram hands out ?igsh= and LinkedIn ?utm_source=share_via when you use
 * their share sheets; both identify who did the sharing. Keeping them would
 * pass that on to every visitor who clicks, and the profile resolves
 * identically without them. WhatsApp and Calendly links keep their query
 * strings, because there it carries the prefilled message or booking details.
 */
export function safeProfileUrl(
  value: unknown,
  allowedHosts: string[]
): string {
  const url = safeExternalUrl(value, allowedHosts);
  if (!url) return "";
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

const instagramUrl = z
  .unknown()
  .transform((v) => safeProfileUrl(v, ["instagram.com"]));

const linkedinUrl = z
  .unknown()
  .transform((v) => safeProfileUrl(v, ["linkedin.com"]));

const whatsappUrl = z
  .unknown()
  .transform((v) =>
    safeExternalUrl(v, ["wa.me", "whatsapp.com", "api.whatsapp.com"])
  );

const calendlyUrl = z
  .unknown()
  .transform((v) => safeExternalUrl(v, ["calendly.com"]));

const featureSchema = z.object({
  icon: trimmed(8),
  title: trimmed(80),
  desc: trimmed(200),
});

const serviceItemSchema = z.object({
  title: trimmed(120),
  price: trimmed(60).nullable(),
  unit: trimmed(40).nullable(),
  tags: z.array(trimmed(60)).max(20),
});

const faqItemSchema = z.object({
  question: trimmed(300),
  answer: trimmed(2000),
});

export const siteContentSchema = z.object({
  hero: z.object({
    headline: trimmed(200),
    subtext: trimmed(500),
    quoteText: trimmed(500),
  }),
  about: z.object({
    heading: trimmed(200),
    paragraph: trimmed(3000),
    features: z.array(featureSchema).max(12),
  }),
  services: z.object({
    items: z.array(serviceItemSchema).max(20),
  }),
  issues: z.object({
    heading: trimmed(200),
    intro: trimmed(1000),
    items: z.array(trimmed(200)).max(40),
  }),
  mentoring: z.object({
    heading: trimmed(200),
    subtext: trimmed(1000),
    card1Title: trimmed(200),
    card1Items: z.array(trimmed(200)).max(40),
    card2Title: trimmed(200),
    card2Items: z.array(trimmed(200)).max(40),
  }),
  faq: z.object({
    heading: trimmed(200),
    intro: trimmed(1000),
    items: z.array(faqItemSchema).max(30),
  }),
  contact: z.object({
    heading: trimmed(200),
    subtext: trimmed(1000),
    email: trimmed(254),
    phone: trimmed(40),
    whatsappLink: whatsappUrl,
  }),
  social: z.object({
    instagram: instagramUrl,
    linkedin: linkedinUrl,
  }),
  slidingScale: z.array(trimmed(60)).max(12),
  calendlyUrl,
  studentNote: trimmed(2000),
});

// ─── Blog ──────────────────────────────────────────

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogPostSchema = z.object({
  id: trimmed(64).optional(),
  slug: trimmed(120)
    .min(1, "Slug is required")
    .regex(SLUG_PATTERN, "Slug may contain lowercase letters, numbers and hyphens only"),
  title: trimmed(200).min(1, "Title is required"),
  excerpt: trimmed(400).optional().default(""),
  content: trimmed(100_000).min(1, "Post content is required"),
  coverImage: z.unknown().transform((v) => safeExternalUrl(v)),
  coverAlt: trimmed(200).optional().default(""),
  tags: z.array(trimmed(40)).max(12).optional().default([]),
  status: z.enum(["draft", "published"]).default("draft"),
  seoTitle: trimmed(200).optional().default(""),
  seoDescription: trimmed(400).optional().default(""),
  publishedAt: trimmed(40).optional().default(""),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;

/** Turns a Zod error into one short, user-facing sentence. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
