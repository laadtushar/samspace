"use client";

import { useMemo } from "react";
import { usePricing } from "@/lib/use-pricing";
import { swapsFor, applySwaps } from "@/lib/price-swap";

/**
 * A piece of copy with its rupee figures swapped for converted ones.
 *
 * The server renders the rupee text into the cached HTML, which is what a
 * crawler indexes, what someone without JavaScript reads, and what is actually
 * billed. This replaces the figures afterwards, for this visitor, so that a
 * page does not quote one currency in its services card and another in its
 * FAQ two sections below.
 *
 * Renders a plain string, never markup: it is handed stored content, and
 * anything cleverer than text substitution on stored content is a way to put
 * somebody else's HTML on the page.
 */
export default function ConvertedText({
  text,
  enabled,
  className,
}: {
  text: string;
  /** The rollout switch, decided on the server. */
  enabled: boolean;
  className?: string;
}) {
  const view = usePricing(enabled);
  const shown = useMemo(() => applySwaps(text, swapsFor(view)), [text, view]);

  return className ? <span className={className}>{shown}</span> : <>{shown}</>;
}
