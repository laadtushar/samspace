import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/*
  A booking page that can be reached before the form is saved is how a slot gets
  taken with nothing to prepare from: the page sat second in the flow, ahead of
  the questions, and closing the dialog left the booking behind.

  The modal cannot be rendered in this environment, so the order is asserted on
  its source, the same way the public-route tests assert that no route grows its
  own catch. Each check is a way the guarantee could be undone by a later edit.
*/
const source = readFileSync(
  path.join(process.cwd(), "components/IntakeFormModal.tsx"),
  "utf8"
);

describe("the booking page follows a saved form", () => {
  it("is not one of the form's steps", () => {
    expect(source).not.toMatch(/id:\s*"schedule"/);
    expect(source).not.toMatch(/currentStep === "schedule"/);
  });

  it("is mounted once, inside the saved-form screen", () => {
    expect(source.match(/<iframe/g)).toHaveLength(1);
    const savedScreen = source.indexOf("{submitted ? (");
    expect(savedScreen).toBeGreaterThan(-1);
    expect(source.indexOf("<iframe")).toBeGreaterThan(savedScreen);
  });

  it("opens only after the server has accepted the form", () => {
    const accepted = source.indexOf("if (!res.ok)");
    const opened = source.indexOf("setSubmitted(true)");
    expect(accepted).toBeGreaterThan(-1);
    expect(opened).toBeGreaterThan(accepted);
    // Nothing else may open it: not a button, not a message from the frame.
    expect(source.match(/setSubmitted\(true\)/g)).toHaveLength(1);
  });

  it("cannot be marked booked by anything but the provider's own message", () => {
    // The old "I've already booked a slot" button let anyone claim a booking
    // without the form; the only route to `booked` is the origin-checked event.
    expect(source).not.toMatch(/already booked/i);
    expect(source.match(/setBooked\(true\)/g)).toHaveLength(1);
    expect(source).toContain("isBookingConfirmation(calendlyUrl, e.origin, e.data)");
  });

  it("is not lost to a stray tap outside the dialog or Escape", () => {
    // Closing resets the form, so dismissing the booking screen by accident
    // would mean refilling and resubmitting: a duplicate intake.
    expect(source).toMatch(/onClick=\{handleOutsideClose\}/);
    expect(source).toMatch(/e\.key === "Escape"\) handleOutsideClose\(\)/);
    expect(source).toMatch(/if \(submitted && !booked\) return;/);
  });
});
