"use client";

import { useEffect, useState } from "react";
import type { PricingView } from "@/lib/pricing";

/**
 * A price, in the money the visitor thinks in.
 *
 * The rupee figure is what renders — always, on the server, into the cached
 * HTML. That is deliberate and is the whole design: every public page is ISR,
 * one stored copy of the markup shared by everyone, so a figure that depends on
 * who is asking cannot go into it without either giving up that cache or
 * splitting it per country. It is also the figure a crawler should index, the
 * one the structured data quotes, and the one the invoice will say.
 *
 * So the conversion happens here, after hydration, for that visitor alone. If
 * the request fails, is slow, or never runs because JavaScript did not, what
 * stays on screen is the rupee price — correct, just less helpful to someone
 * working out whether they can afford a session.
 */
export default function Price({
  rupees,
  enabled,
  className,
}: {
  /** What the page rendered, and what stays if anything goes wrong. */
  rupees: string;
  /** The rollout switch, decided on the server. */
  enabled: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!enabled) return;

    // Abandoned if the visitor navigates away mid-flight, so a late response
    // cannot rewrite a price on a page they have already left.
    const abort = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/pricing", { signal: abort.signal });
        if (!res.ok) return;

        const view = (await res.json()) as PricingView;
        // `native` means these already are the rupees the practice charges, so
        // there is nothing to swap and the server's figure stands.
        if (view.native || !view.range) return;

        setShown(view.range);
        setNote(view.note ?? "");
      } catch {
        // Offline, aborted, blocked, malformed — all the same answer. The
        // rupee price is already on screen and is not wrong.
      }
    })();

    return () => abort.abort();
  }, [enabled]);

  if (shown === null) return <span className={className}>{rupees}</span>;

  return (
    <span className={className}>
      <span>{shown}</span>
      {note && (
        /*
          Never decoration. Every session is charged and settled in rupees, so
          this figure is an estimate of an invoice that will arrive in another
          currency. A converted price that does not say so is a number someone
          will reasonably expect to be charged.
        */
        <span className="block font-sans text-xs font-normal text-forest/45 mt-1">
          {note}
        </span>
      )}
    </span>
  );
}
