import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { keepEvent } from "@/lib/analytics";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ctx = { pathname: "/", privateSurfaceOpen: false };

/**
 * Analytics on a therapy site must never carry what someone typed or chose
 * about themselves. Statsig's autocapture sends a text input's value as
 * `content`; these hold the filter that stops it.
 */
describe("what analytics may send", () => {
  it("drops any event raised by a form field, whatever its content", () => {
    for (const tagName of ["input", "INPUT", "textarea", "select"]) {
      expect(keepEvent({ eventName: "auto_capture::click", metadata: { tagName, content: "asha@example.com" } }, ctx)).toBe(false);
    }
  });

  it("keeps an ordinary button or link click", () => {
    expect(keepEvent({ eventName: "auto_capture::click", metadata: { tagName: "button", content: "Book a session" } }, ctx)).toBe(true);
    expect(keepEvent({ eventName: "auto_capture::page_view" }, ctx)).toBe(true);
  });

  it("keeps no user action at all while the intake form is open", () => {
    const open = { pathname: "/", privateSurfaceOpen: true };
    for (const eventName of ["auto_capture::click", "auto_capture::rage_click", "auto_capture::dead_click", "auto_capture::form_submit"]) {
      expect(keepEvent({ eventName, metadata: { tagName: "button", content: "Female" } }, open)).toBe(false);
    }
  });

  it("captures nothing on admin pages, and no copy or console events anywhere", () => {
    expect(keepEvent({ eventName: "auto_capture::page_view" }, { pathname: "/admin", privateSurfaceOpen: false })).toBe(false);
    expect(keepEvent({ eventName: "auto_capture::copy" }, ctx)).toBe(false);
    expect(keepEvent({ eventName: "statsig::log_line" }, ctx)).toBe(false);
  });

  it("never installs session replay", () => {
    expect(read("package.json")).not.toContain("@statsig/session-replay");
    expect(read("lib/analytics.ts")).not.toMatch(/SessionReplay/);
  });

  it("names intake progress by step only", () => {
    const form = read("components/IntakeFormModal.tsx");
    expect(form).toContain('track("intake_step", { step: currentStep })');
    expect(form).not.toMatch(/track\([^)]*data\./);
  });
});
