import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The messages a booked session produces.
 *
 * Resend is stubbed: what matters here is who each message reaches and what it
 * says, not that the provider works. The practitioner being blind-copied is the
 * point of these tests — she asked to see what goes out in her name, and a
 * dashboard saying "booked" is not evidence that anyone was told.
 */

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => send(...args) };
  },
}));

const { sendBookingConfirmation, sendCancellationNotice, formatSessionTime } =
  await import("@/lib/session-emails");

const at = "2026-09-15T12:00:00.000Z"; // 17:30 in the practice's timezone

beforeEach(() => {
  process.env.RESEND_API = "test-key";
  send.mockReset().mockResolvedValue({ error: null });
});

describe("booking confirmation", () => {
  const args = {
    clientName: "Asha Rao",
    clientEmail: "asha@example.com",
    startsAt: at,
  };

  it("goes to the client and blind-copies the practitioner", async () => {
    await sendBookingConfirmation(args);
    const [payload] = send.mock.calls[0];
    expect(payload.to).toBe("asha@example.com");
    expect(payload.bcc).toBe("Priyankavarma785@gmail.com");
    expect(payload.replyTo).toBe("Priyankavarma785@gmail.com");
  });

  it("states the time in the practice's timezone, not the server's", async () => {
    await sendBookingConfirmation(args);
    const [payload] = send.mock.calls[0];
    // 12:00 UTC is 17:30 in Asia/Kolkata; a server in UTC must not say 12:00.
    expect(payload.subject).toContain("5:30 pm");
    expect(payload.html).toContain("5:30 pm");
  });

  it("names the person and says how long it runs", async () => {
    await sendBookingConfirmation(args);
    const [payload] = send.mock.calls[0];
    expect(payload.html).toContain("Asha Rao");
    expect(payload.html).toContain("50 minutes");
  });

  it("escapes a name so it cannot inject markup", async () => {
    await sendBookingConfirmation({
      ...args,
      clientName: '<img src=x onerror="alert(1)">',
    });
    const [payload] = send.mock.calls[0];
    expect(payload.html).not.toContain("<img");
    expect(payload.html).toContain("&lt;img");
  });

  it("reports failure rather than throwing, so a booking still stands", async () => {
    send.mockResolvedValue({ error: { message: "provider down" } });
    const result = await sendBookingConfirmation(args);
    expect(result.sent).toBe(false);
  });

  it("does not pretend to send with no API key", async () => {
    delete process.env.RESEND_API;
    const result = await sendBookingConfirmation(args);
    expect(result.sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("cancellation notice", () => {
  it("reaches the client, blind-copies her, and says which session", async () => {
    await sendCancellationNotice({
      clientName: "Asha Rao",
      clientEmail: "asha@example.com",
      startsAt: at,
    });
    const [payload] = send.mock.calls[0];
    expect(payload.to).toBe("asha@example.com");
    expect(payload.bcc).toBe("Priyankavarma785@gmail.com");
    expect(payload.subject).toMatch(/cancelled/i);
    expect(payload.subject).toContain("5:30 pm");
  });

  it("offers to rebook rather than just closing the door", async () => {
    await sendCancellationNotice({
      clientName: "Asha Rao",
      clientEmail: "asha@example.com",
      startsAt: at,
    });
    const [payload] = send.mock.calls[0];
    expect(payload.html).toMatch(/another time/i);
  });
});

describe("session time formatting", () => {
  it("is the practice's timezone regardless of where this runs", () => {
    expect(formatSessionTime(at)).toContain("5:30 pm");
    expect(formatSessionTime(at)).toContain("15 September");
  });
});
