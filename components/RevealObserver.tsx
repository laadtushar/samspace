"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef } from "react";

// A layout effect in the browser; nothing on the server, where React would warn.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/*
  Scroll reveals and the motion stylesheet, loaded after the page's own
  JavaScript (RevealRuntime and motion.css), so that none of it is in front of
  the first paint. The server renders every reveal visible; nothing waits on
  this to be seen.
*/
const RevealRuntime = dynamic(() => import("./RevealRuntime"), { ssr: false });

export default function RevealObserver() {
  /*
    Whether the page has already been painted when the runtime mounts. After
    a full page load it has (the runtime arrives later), so what is on screen
    stays put. When the runtime is already loaded — arriving here from another
    page — it mounts in the same commit as the page, before this layout effect
    runs, and everything can enter as new.
  */
  const painted = useRef(false);
  useIsomorphicLayoutEffect(() => {
    painted.current = true;
  }, []);
  return <RevealRuntime painted={painted} />;
}
