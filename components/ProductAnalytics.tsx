"use client";

import { useEffect } from "react";
import { startAnalytics } from "@/lib/analytics";

/** Starts product analytics once the page is idle. Renders nothing. */
export default function ProductAnalytics() {
  useEffect(() => {
    const start = () => void startAnalytics().catch(() => undefined);
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (idle) idle(start);
    else setTimeout(start, 1500);
  }, []);
  return null;
}
