"use client";

import { useEffect, useState } from "react";
import type { PricingView } from "@/lib/pricing";

/**
 * The pricing view, fetched once for the whole page.
 *
 * Several places on a page mention a price — the services card, the FAQ
 * answer, the intake form's assurances and its slider — and each needs the
 * same answer.
 * A hook that fetched per component would make four identical requests on
 * every load, so the request is made once and its promise shared.
 *
 * Cached for the life of the document, not beyond. The endpoint is already
 * cached at the edge per country, and a visitor's country does not change
 * while they read a page.
 */

let inFlight: Promise<PricingView | null> | null = null;

/** Discards the shared request. Tests only — a page never needs this. */
export function resetPricingCache(): void {
  inFlight = null;
}

function load(): Promise<PricingView | null> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/pricing");
      if (!res.ok) return null;
      return (await res.json()) as PricingView;
    } catch {
      // Offline, blocked, malformed — all the same answer. The rupee figures
      // are already on screen and none of them is wrong.
      return null;
    }
  })();

  return inFlight;
}

/**
 * Null until it arrives, and null forever if it does not.
 *
 * Every caller renders the server's rupee figure while this is null, so a slow
 * or failed request costs a conversion and nothing else.
 */
export function usePricing(enabled: boolean): PricingView | null {
  const [view, setView] = useState<PricingView | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let live = true;
    void load().then((result) => {
      // Guarded so a late response cannot write into a component the visitor
      // has already navigated away from.
      if (live) setView(result);
    });

    return () => {
      live = false;
    };
  }, [enabled]);

  return view;
}
