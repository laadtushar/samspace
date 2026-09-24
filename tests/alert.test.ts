import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendEmail = vi.fn(async (_args: { to: string }) => ({ sent: true }));
vi.mock("@/lib/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/email")>()),
  sendEmail,
}));

const { log } = await import("@/lib/log");
const { shouldAlert, alertMessage, resetAlertThrottle } = await import("@/lib/alert");

/**
 * An error nobody hears about is a person who asked for help and was never
 * seen. These hold the three things that make an alert usable: it is opt-in,
 * it cannot flood, and it says nothing the log line would not.
 */

beforeEach(() => {
  resetAlertThrottle();
  sendEmail.mockClear();
  delete process.env.ALERT_EMAIL;
  delete process.env.ALERT_THROTTLE_MINUTES;
});
afterEach(() => {
  delete process.env.ALERT_EMAIL;
  delete process.env.ALERT_THROTTLE_MINUTES;
});

describe("failure alerts", () => {
  it("send nothing unless an address is configured", () => {
    log.error("intake.store_failed", { ref: "abc12345" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("email an error-level event to the configured address", () => {
    process.env.ALERT_EMAIL = "ops@example.com";
    log.error("intake.store_failed", { ref: "abc12345" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "ops@example.com" });
  });

  it("never alert on warnings or info", () => {
    process.env.ALERT_EMAIL = "ops@example.com";
    log.warn("intake.rejected", { reason: "rate_limited" });
    log.info("intake.accepted", {});
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("send one email per event per window, however many requests fail", () => {
    process.env.ALERT_EMAIL = "ops@example.com";
    for (let i = 0; i < 25; i += 1) log.error("content.db_read_failed", { ref: `r${i}` });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    // A different failure is news, so it is not held back by the first.
    log.error("reminders.failed", {});
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("let the same event through again once the window has passed", () => {
    process.env.ALERT_EMAIL = "ops@example.com";
    process.env.ALERT_THROTTLE_MINUTES = "10";
    const t0 = 1_000_000;
    expect(shouldAlert("fx.failed", t0)).toBe(true);
    expect(shouldAlert("fx.failed", t0 + 9 * 60_000)).toBe(false);
    expect(shouldAlert("fx.failed", t0 + 10 * 60_000)).toBe(true);
  });

  it("carry only the log line's own fields, escaped", () => {
    const { subject, html } = alertMessage("upload.failed", "2026-09-24T00:00:00Z", {
      ref: "abc12345",
      errorMessage: "<script>x</script>",
    });
    expect(subject).toBe("Site error: upload.failed");
    expect(html).toContain("abc12345");
    expect(html).not.toContain("<script>x</script>");
  });

  it("never throw into the request that failed, even if the send does", async () => {
    process.env.ALERT_EMAIL = "ops@example.com";
    sendEmail.mockImplementationOnce(async (_args: { to: string }) => {
      throw new Error("transport down");
    });
    expect(() => log.error("session.create_failed", {})).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
