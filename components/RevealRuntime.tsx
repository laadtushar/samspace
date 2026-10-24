"use client";

import "./motion.css";
import { useLayoutEffect, type MutableRefObject } from "react";

/**
 * The one IntersectionObserver behind every scroll reveal on the site, and the
 * stylesheet for everything below the hero that moves (motion.css). Loaded by
 * RevealObserver after the page's JavaScript, so neither stands in the way of
 * the first paint.
 *
 * Reveals used to be framer-motion components, each with its own observer and
 * each rendered by the server at opacity 0. That had two costs. The page could
 * not show a single revealed line until framer-motion had downloaded and the
 * page had hydrated, and if that JavaScript failed or was slow the text simply
 * stayed invisible. And every one of them was work on the main thread while the
 * page was trying to become usable.
 *
 * Now a reveal is markup and CSS (Reveal, TextReveal, the .reveal rules in
 * motion.css), and the server renders it fully visible. Only this hides
 * anything, and only once it is running and watching: it marks each element it
 * has taken charge of `data-reveal="wait"` (hidden) and flips it to `"in"` (the
 * CSS entrance plays) when it scrolls into view. Without JavaScript, or before
 * it arrives, nothing is ever hidden.
 *
 * What is already on screen once the page has been painted is left exactly as
 * it is ("shown"): fading it out to fade it back in would be a flicker, not an
 * entrance. On a page rendered fresh on the client (arriving from another
 * page), everything enters as it always did.
 *
 * Mounting it more than once is harmless; an element is only taken once.
 */

const observers = new Map<string, IntersectionObserver>();

function observerFor(margin: string) {
  let observer = observers.get(margin);
  if (!observer) {
    observer = new IntersectionObserver(
      (entries, self) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = "in";
          self.unobserve(entry.target);
        }
      },
      // The same margins the framer-motion versions used (useInView's
      // `margin`), so each reveal fires at the same scroll position.
      { rootMargin: margin }
    );
    observers.set(margin, observer);
  }
  return observer;
}

function hide(el: HTMLElement) {
  el.dataset.reveal = "wait";
  observerFor(el.dataset.revealMargin || "0px").observe(el);
}

/*
  On a page that has already been painted, what is on screen is told apart
  from what is not by an observer too, rather than by measuring each element
  here: measuring forces a full style and layout pass on the main thread, and
  an observer gets the same answer from the layout the browser does anyway.
  Until it answers ("sorting"), everything stays as it was drawn.
*/
let sorter: IntersectionObserver | null = null;

function sortByViewport(el: HTMLElement) {
  sorter ??= new IntersectionObserver((entries, self) => {
    for (const entry of entries) {
      const target = entry.target as HTMLElement;
      self.unobserve(target);
      if (target.dataset.reveal !== "sorting") continue;
      if (entry.isIntersecting) target.dataset.reveal = "shown";
      else hide(target);
    }
  });
  el.dataset.reveal = "sorting";
  sorter.observe(el);
}

function watchReveals(painted: boolean) {
  // No observer, no hiding: the content simply stays visible.
  if (typeof IntersectionObserver === "undefined") return;
  document
    .querySelectorAll<HTMLElement>(
      ".reveal:not([data-reveal]), .reveal-words:not([data-reveal])"
    )
    .forEach(painted ? sortByViewport : hide);
}

export default function RevealRuntime({
  painted,
}: {
  /** Whether the page was on screen before this mounted. */
  painted: MutableRefObject<boolean>;
}) {
  // A layout effect, so on a page rendered fresh on the client what is about
  // to be revealed is hidden before the first paint rather than after it.
  useLayoutEffect(() => {
    watchReveals(painted.current);
  }, [painted]);
  return null;
}
