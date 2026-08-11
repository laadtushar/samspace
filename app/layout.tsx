import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { BotIdClient } from "botid/client";
import {
  SITE_URL,
  SITE_NAME,
  IS_PRODUCTION_SITE,
  serializeJsonLd,
} from "@/lib/site";
import { defaultContent } from "@/lib/content";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Samvriti.Space — Priyanka Varma | Counselling Psychologist & Academic Mentor",
    template: "%s | Samvriti.Space",
  },
  description:
    "Online therapy and academic mentoring for young adults (18–28) navigating anxiety, stress, self-esteem, and life transitions. M.Sc. Clinical Psychology, UGC NET-JRF & GATE Qualified. Sessions ₹500–₹1000.",
  keywords: [
    "counselling psychologist",
    "online therapy India",
    "online counselling",
    "academic mentoring",
    "UGC NET JRF psychology",
    "GATE psychology preparation",
    "young adults therapy",
    "CBT therapy online",
    "trauma-informed care",
    "humanistic therapy",
    "Priyanka Varma psychologist",
    "Samvriti Space",
    "anxiety therapy online",
    "student mental health",
    "psychology career guidance",
    "sliding scale therapy India",
    "affordable therapy India",
  ],
  authors: [{ name: "Priyanka Varma", url: SITE_URL }],
  creator: "Priyanka Varma",
  publisher: "Samvriti.Space",
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": [
        { url: "/blog/rss.xml", title: `${SITE_NAME} — Writing` },
      ],
    },
  },
  openGraph: {
    title: "Samvriti.Space — Online Therapy & Academic Mentoring",
    description:
      "Counselling psychologist Priyanka Varma offers online therapy (₹500–₹1000) and academic mentoring for young adults. M.Sc. Clinical Psychology, UGC NET-JRF & GATE Qualified.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Samvriti.Space — Online Therapy & Academic Mentoring",
    description:
      "Counselling psychologist for young adults. CBT, Humanistic, Trauma-Informed Care. Sessions ₹500–₹1000. Book online.",
  },
  robots: {
    index: IS_PRODUCTION_SITE,
    follow: IS_PRODUCTION_SITE,
    googleBot: {
      index: IS_PRODUCTION_SITE,
      follow: IS_PRODUCTION_SITE,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

/**
 * Endpoints BotID watches. Both send email to an address the caller supplies,
 * which is exactly what a spam script looks for. Next 14 predates
 * instrumentation-client.ts, so the client is mounted in <head> instead.
 *
 * It is mounted only when the server is actually enforcing BotID. The client
 * replaces window.fetch for these paths and routes it through a challenge; if
 * that challenge cannot load — blocked script, offline moment, BotID not
 * provisioned — the request never leaves the browser and the person sees a
 * generic failure with nothing in the server logs. That was observed happening.
 * While the server treats a bot verdict as advisory, the challenge buys nothing
 * and can only cost someone their submission.
 */
const botProtectedRoutes = [
  { path: "/api/intake", method: "POST" },
  { path: "/api/contact", method: "POST" },
];

const botIdEnforced = process.env.BOTID_ENFORCE === "true";

export const viewport: Viewport = {
  themeColor: "#2c3a2e",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Entities are given @ids and cross-referenced, so search engines read one
  // linked graph — the business, the person behind it, and the site — rather
  // than three unrelated islands. The FAQ mirrors the section rendered on the
  // page; markup for questions a visitor cannot see is a policy violation.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["ProfessionalService", "MedicalBusiness"],
        "@id": `${SITE_URL}#business`,
        name: SITE_NAME,
        description:
          "Online counselling and academic mentoring for young adults by Priyanka Varma, M.Sc. Clinical Psychology.",
        url: SITE_URL,
        image: `${SITE_URL}/priyanka.jpeg`,
        priceRange: "₹500–₹1000",
        currenciesAccepted: "INR",
        areaServed: { "@type": "Country", name: "India" },
        availableLanguage: ["English", "Hindi"],
        serviceType: ["Counselling Psychology", "Academic Mentoring"],
        medicalSpecialty: "Psychiatric",
        email: defaultContent.contact.email,
        telephone: defaultContent.contact.phone,
        sameAs: [
          defaultContent.contact.whatsappLink,
          defaultContent.social.instagram,
          defaultContent.social.linkedin,
        ].filter(Boolean),
        founder: { "@id": `${SITE_URL}#priyanka` },
        provider: { "@id": `${SITE_URL}#priyanka` },
        availableChannel: {
          "@type": "ServiceChannel",
          serviceType: "Online",
          serviceUrl: `${SITE_URL}/?intake=true`,
        },
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Sessions",
          itemListElement: [
            {
              "@type": "Offer",
              name: "Therapy Session",
              description: "45–50 minute online therapy session, sliding scale.",
              priceSpecification: {
                "@type": "PriceSpecification",
                priceCurrency: "INR",
                minPrice: 500,
                maxPrice: 1000,
              },
            },
            {
              "@type": "Offer",
              name: "Academic Mentoring Session",
              description:
                "Career and exam-strategy mentoring for psychology students.",
              priceSpecification: {
                "@type": "PriceSpecification",
                priceCurrency: "INR",
                price: 1000,
              },
            },
          ],
        },
      },
      {
        "@type": "Person",
        "@id": `${SITE_URL}#priyanka`,
        name: "Priyanka Varma",
        sameAs: [
          defaultContent.social.linkedin,
          defaultContent.social.instagram,
        ].filter(Boolean),
        jobTitle: "Counselling Psychologist & Academic Mentor",
        description:
          "M.Sc. Clinical Psychology, UGC NET-JRF & GATE Qualified. Lecturer and counselling psychologist specializing in young adult mental health.",
        url: SITE_URL,
        image: `${SITE_URL}/priyanka.jpeg`,
        email: defaultContent.contact.email,
        knowsLanguage: ["en", "hi"],
        worksFor: { "@id": `${SITE_URL}#business` },
        hasCredential: [
          {
            "@type": "EducationalOccupationalCredential",
            credentialCategory: "M.Sc. Clinical Psychology",
          },
          {
            "@type": "EducationalOccupationalCredential",
            credentialCategory: "UGC NET-JRF",
          },
          {
            "@type": "EducationalOccupationalCredential",
            credentialCategory: "GATE (Psychology)",
          },
        ],
        knowsAbout: [
          "Cognitive Behavioral Therapy",
          "Humanistic Therapy",
          "Trauma-Informed Care",
          "Academic Mentoring",
          "Young Adult Mental Health",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: "en-IN",
        publisher: { "@id": `${SITE_URL}#business` },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}#faq`,
        mainEntity: defaultContent.faq.items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <html lang="en-IN" className="scroll-smooth">
      <head>
        {botIdEnforced && <BotIdClient protect={botProtectedRoutes} />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      </head>
      <body
        className={`${cormorant.variable} ${dmSans.variable} font-sans bg-cream text-forest antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
