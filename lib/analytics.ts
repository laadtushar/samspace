"use client";

import type { StatsigClient } from "@statsig/js-client";

/**
 * Product analytics (Statsig): clicks, rage clicks, dead clicks, page views,
 * web vitals, and a few named events — the "hotspots" view, without recordings.
 *
 * What it must never carry is anything a person typed. Statsig's autocapture
 * treats textareas and selects as sensitive, but a plain text or email input
 * falls through and its value is sent as `content`
 * (@statsig/web-analytics 3.33.5, src/utils/eventUtils.js). So:
 *
 *   - any event raised by an input element is dropped;
 *   - while the intake form is open, no user-action event is kept at all —
 *     its answer buttons carry gender, language and the like. The form's
 *     progress is recorded instead as named steps that contain no answers;
 *   - nothing is captured on /admin;
 *   - copy events and console capture are off;
 *   - session replay is not installed.
 *
 * Off entirely when NEXT_PUBLIC_STATSIG_CLIENT_KEY is unset. Loaded after the
 * page is idle, so it never competes with the first paint.
 */

const CLIENT_KEY = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY;

/** Paths where nothing is captured. */
const PRIVATE_PATHS = ["/admin"];

let client: StatsigClient | null = null;
let privateSurfaceOpen = false;

const USER_ACTIONS = new Set([
  "auto_capture::click",
  "auto_capture::rage_click",
  "auto_capture::dead_click",
  "auto_capture::form_submit",
  "auto_capture::copy",
]);

/** Exported for tests: whether an autocaptured event may be sent. */
export function keepEvent(
  event: { eventName: string; metadata?: Record<string, unknown> | null },
  context: { pathname: string; privateSurfaceOpen: boolean }
): boolean {
  if (PRIVATE_PATHS.some((p) => context.pathname.startsWith(p))) return false;
  if (event.eventName === "auto_capture::copy") return false;
  if (event.eventName === "statsig::log_line") return false;
  const tag = String(event.metadata?.tagName ?? "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return false;
  if (context.privateSurfaceOpen && USER_ACTIONS.has(event.eventName)) return false;
  return true;
}

export async function startAnalytics(): Promise<void> {
  if (!CLIENT_KEY || client || typeof window === "undefined") return;
  if (PRIVATE_PATHS.some((p) => window.location.pathname.startsWith(p))) return;

  const [{ StatsigClient }, { StatsigAutoCapturePlugin }] = await Promise.all([
    import("@statsig/js-client"),
    import("@statsig/web-analytics"),
  ]);

  client = new StatsigClient(
    CLIENT_KEY,
    {},
    {
      environment: {
        // Preview deployments carry the same key; keep their traffic apart.
        tier: process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "development",
      },
      plugins: [
        new StatsigAutoCapturePlugin({
          eventFilterFunc: (event) =>
            keepEvent(event, {
              pathname: window.location.pathname,
              privateSurfaceOpen,
            }),
        }),
      ],
    }
  );
  await client.initializeAsync();
}

/**
 * Pauses user-action capture while something private is on screen (the
 * intake form). Named events from `track` still go through.
 */
export function setPrivateSurface(open: boolean): void {
  privateSurfaceOpen = open;
}

/**
 * A named event. Callers pass labels and step names only — never an answer
 * someone gave, and never anything they typed.
 */
export function track(name: string, metadata?: Record<string, string>): void {
  client?.logEvent(name, undefined, metadata);
}
