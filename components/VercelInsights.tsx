"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { withoutPreviews } from "@/lib/insights-filter";

/**
 * Vercel Analytics and Speed Insights, minus anything under /preview.
 *
 * A client component because beforeSend is a function, which the server
 * layout cannot hand to a client component as a prop.
 */
export default function VercelInsights() {
  return (
    <>
      <Analytics beforeSend={withoutPreviews} />
      <SpeedInsights beforeSend={withoutPreviews} />
    </>
  );
}
