import type { MetadataRoute } from "next";

/**
 * Web app manifest.
 *
 * Mostly this exists so a phone that saves the site to its home screen shows
 * the right name and colours rather than a screenshot and a truncated URL.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Samvriti.Space — Online Therapy & Academic Mentoring",
    short_name: "Samvriti.Space",
    description:
      "Online therapy and academic mentoring for young adults by Priyanka Varma, M.Sc. Clinical Psychology.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3ed",
    theme_color: "#2c3a2e",
    lang: "en-IN",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
