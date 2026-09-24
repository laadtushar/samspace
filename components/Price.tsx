"use client";

import { useMemo } from "react";
import { usePricing } from "@/lib/use-pricing";
import { swapsFor, applySwaps } from "@/lib/price-swap";

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
 *
 * It converts the figure it was handed, and nothing else.
 *
 * This used to render `view.range` — the therapy sliding scale — whenever a
 * conversion was available, whatever price it had been given. The therapy card
 * quotes that range, so it looked right; the academic mentoring card, a flat
 * ₹1000, was shown the therapy scale instead. Not a currency being wrong but a
 * price being wrong: AED 35–AED 45 in place of AED 45, opening 22% under what
 * the session costs. Converting the given text is also what ConvertedText does,
 * so the two agree by construction rather than by coincidence.
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
  const view = usePricing(enabled);
  const shown = useMemo(() => applySwaps(rupees, swapsFor(view)), [rupees, view]);

  /*
    The note belongs to a figure that actually changed. `swapsFor` is already
    empty when the view is native or has nothing converted, so this is only
    false for the other case: a rupee figure that is not on the scale, left
    alone on purpose, which must not be labelled an approximation.
  */
  const converted = shown !== rupees;
  const note = converted ? view?.note ?? "" : "";

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
