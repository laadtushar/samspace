"use client";

import { MotionConfig } from "framer-motion";

/**
 * Honours "reduce motion" across every animation on the site.
 *
 * The CSS already quietened one slider, but everything else — the hero reveal,
 * the floating cards, the scroll-triggered sections — is framer-motion and ran
 * regardless of what the reader had asked their device for. `reducedMotion:
 * "user"` makes framer-motion drop transform and layout animation for those
 * people while leaving opacity alone, so content still appears; it simply
 * stops moving.
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
