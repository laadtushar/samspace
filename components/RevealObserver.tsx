"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

/**
 * The one IntersectionObserver behind every scroll reveal on the site.
 *
 * Reveals used to be framer-motion components, each with its own observer and
 * each rendered by the server at opacity 0. That had two costs. The page could
 * not show a single revealed line until framer-motion had downloaded and the
 * page had hydrated, and if that JavaScript failed or was slow the text simply
 * stayed invisible. And every one of them was work on the main thread while the
 * page was trying to become usable.
 *
 * Now a reveal is markup and CSS (Reveal, TextReveal, the .reveal rules in
 * globals.css), and the server renders it fully visible. Only this component
 * hides anything, and only once it is running and watching: it marks each
 * element it has taken charge of `data-reveal="wait"` (hidden) and flips it to
 * `"in"` (the CSS entrance plays) when it scrolls into view. Without
 * JavaScript, or before it arrives, nothing is ever hidden.
 *
 * What is already on screen when the page hydrates is left exactly as it is
 * ("shown"): it has been painted, and fading it out to fade it back in would
 * be a flicker, not an entrance. Rendered fresh on the client (arriving from
 * another page), everything enters as it always did.
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
  While hydrating, what is on screen is told apart from what is not by an
  observer too, rather than by measuring each element here. Measuring in the
  middle of hydration forces a full style and layout pass on the main thread,
  in the one task the page can least afford to lengthen; an observer gets the
  same answer from the layout the browser does anyway. Until it answers
  ("sorting"), everything simply stays as the server drew it.
*/
let sorter: IntersectionObserver | null = null;

function sortAfterHydration(el: HTMLElement) {
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

function watchReveals(hydrating: boolean) {
  // No observer, no hiding: the content simply stays visible.
  if (typeof IntersectionObserver === "undefined") return;
  document
    .querySelectorAll<HTMLElement>(
      ".reveal:not([data-reveal]), .reveal-words:not([data-reveal])"
    )
    .forEach(hydrating ? sortAfterHydration : hide);
}

const noSubscription = () => () => {};

// useLayoutEffect, so a client render hides what it is about to reveal before
// the first paint rather than after it. (It does nothing on the server, where
// React would warn about it.)
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function RevealObserver() {
  // True on the render that hydrates server HTML, false on a client render:
  // React reads the server snapshot only while hydrating.
  const hydrating = useSyncExternalStore(
    noSubscription,
    () => false,
    () => true
  );
  const wasHydrating = useRef(hydrating);

  useIsomorphicLayoutEffect(() => {
    watchReveals(wasHydrating.current);
  }, []);

  return null;
}
