"use client";

import { MotionConfig } from "framer-motion";

/**
 * Honours "reduce motion" across every framer-motion animation on the site.
 *
 * framer-motion ran regardless of what the reader had asked their device for.
 * `reducedMotion: "user"` makes it drop transform and layout animation for
 * those people while leaving opacity alone, so content still appears; it
 * simply stops moving.
 *
 * Most of the site no longer animates with framer-motion — the homepage, the
 * navbar and the footer are CSS now, and honour the same setting through
 * `prefers-reduced-motion` in globals.css and motion.css. What is left (the
 * intake form, the /start page, the admin dashboard) still relies on this. It costs about a
 * kilobyte in every page's first download: MotionConfig and its context, not
 * the animation engine, which only loads with those components.
 *
 * This matters more here than on most sites. Motion triggers nausea and
 * dizziness for anyone with a vestibular disorder, and a page about anxiety is
 * a bad place to make somebody feel physically unwell. The setting is a
 * request, and it was being ignored.
 */
export default function MotionPreferences({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
