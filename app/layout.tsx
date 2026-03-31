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
  title: "Samvriti.Space — Priyanka Varma | Counselling Psychologist & Academic Mentor",
  description:
    "Online therapy and academic mentoring for young adults navigating life's most challenging transitions. M.Sc. Clinical Psychology, UGC NET-JRF & GATE Qualified.",
  keywords: [
    "counselling psychologist",
    "online therapy",
    "academic mentoring",
    "UGC NET JRF",
    "GATE psychology",
    "young adults therapy",
    "CBT",
    "Priyanka Varma",
    "Samvriti Space",
  ],
  openGraph: {
    title: "Samvriti.Space — Priyanka Varma | Counselling Psychologist",
    description:
      "Online therapy and academic mentoring for young adults. M.Sc. Clinical Psychology, UGC NET-JRF & GATE Qualified.",
    url: "https://samvritispace.com",
    siteName: "Samvriti.Space",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Samvriti.Space — Counselling Psychologist & Academic Mentor",
    description:
      "Online therapy and academic mentoring for young adults navigating life's most challenging transitions.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${cormorant.variable} ${dmSans.variable} font-sans bg-cream text-forest antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
