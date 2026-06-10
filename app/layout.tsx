import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
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
  metadataBase: new URL("https://samvritispace.com"),
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
  authors: [{ name: "Priyanka Varma", url: "https://samvritispace.com" }],
  creator: "Priyanka Varma",
  publisher: "Samvriti.Space",
  alternates: {
    canonical: "https://samvritispace.com",
  },
  openGraph: {
    title: "Samvriti.Space — Online Therapy & Academic Mentoring",
    description:
      "Counselling psychologist Priyanka Varma offers online therapy (₹500–₹1000) and academic mentoring for young adults. M.Sc. Clinical Psychology, UGC NET-JRF & GATE Qualified.",
    url: "https://samvritispace.com",
    siteName: "Samvriti.Space",
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
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {},
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfessionalService",
        name: "Samvriti.Space",
        description:
          "Online counselling and academic mentoring for young adults by Priyanka Varma, M.Sc. Clinical Psychology.",
        url: "https://samvritispace.com",
        priceRange: "₹500–₹1000",
        areaServed: "IN",
        serviceType: ["Counselling Psychology", "Academic Mentoring"],
        availableChannel: {
          "@type": "ServiceChannel",
          serviceType: "Online",
        },
      },
      {
        "@type": "Person",
        name: "Priyanka Varma",
        jobTitle: "Counselling Psychologist & Academic Mentor",
        description:
          "M.Sc. Clinical Psychology, UGC NET-JRF & GATE Qualified. Lecturer and counselling psychologist specializing in young adult mental health.",
        url: "https://samvritispace.com",
        worksFor: {
          "@type": "Organization",
          name: "Samvriti.Space",
        },
        hasCredential: [
          { "@type": "EducationalOccupationalCredential", credentialCategory: "M.Sc. Clinical Psychology" },
          { "@type": "EducationalOccupationalCredential", credentialCategory: "UGC NET-JRF" },
          { "@type": "EducationalOccupationalCredential", credentialCategory: "GATE (Psychology)" },
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
        name: "Samvriti.Space",
        url: "https://samvritispace.com",
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What type of therapy does Samvriti.Space offer?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Samvriti.Space offers online therapy using an eclectic approach integrating CBT, Humanistic Therapy, and Trauma-Informed Care, tailored to each individual's needs.",
            },
          },
          {
            "@type": "Question",
            name: "How much does a therapy session cost?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Therapy sessions are offered on a sliding scale of ₹500–₹1000 per session. Students can access sessions at ₹500. No judgement.",
            },
          },
          {
            "@type": "Question",
            name: "Who is Priyanka Varma?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Priyanka Varma is a UGC NET-JRF & GATE qualified counselling psychologist with an M.Sc. in Clinical Psychology. She works with young adults (18–28) experiencing anxiety, stress, self-esteem issues, and life transitions.",
            },
          },
          {
            "@type": "Question",
            name: "Are the sessions online?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, all therapy and mentoring sessions are conducted online. Each session is 45–50 minutes long and fully confidential.",
            },
          },
        ],
      },
    ],
  };

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
