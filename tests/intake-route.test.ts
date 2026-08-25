import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Contract tests for the intake endpoint.
 *
 * The storage and email layers are stubbed so the route's own decisions — what
 * it accepts, what it refuses and why, what it stores, and what it reports back
 * — can be checked without a Blob store or an email provider. These are the
 * paths a real submission travels through, so a regression here is a client who
 * cannot reach a therapist.
 */

const addSubmission = vi.fn();
const sendEmail = vi.fn();
const isLikelyBot = vi.fn();

vi.mock("@/lib/content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content")>();
  return { ...actual, addSubmission: (...a: unknown[]) => addSubmission(...a) };
});
vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return { ...actual, sendEmail: (...a: unknown[]) => sendEmail(...a) };
});
vi.mock("@/lib/bot-check", () => ({
  isLikelyBot: (...a: unknown[]) => isLikelyBot(...a),
}));

const { POST } = await import("@/app/api/intake/route");

const ORIGIN = "https://samvritispace.com";

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/intake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: ORIGIN,
      host: "samvritispace.com",
      // A distinct address per test keeps the rate limiter out of the way.
      "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = {
  name: "Test Person",
  email: "test@example.com",
  gender: "Female",
  age: "22",
  whatsapp: "9999999999",
  concerns: "Exam stress and trouble sleeping.",
  slidingScale: "₹800",
};

beforeEach(() => {
  addSubmission.mockReset().mockResolvedValue(undefined);
  sendEmail.mockReset().mockResolvedValue({ sent: true });
  isLikelyBot.mockReset().mockResolvedValue(false);
});

describe("POST /api/intake", () => {
  it("accepts a valid submission, stores it, and reports success", async () => {
    const res = await POST(post(valid));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ref).toBeTruthy();
    expect(addSubmission).toHaveBeenCalledTimes(1);

    const stored = addSubmission.mock.calls[0][0];
    expect(stored.name).toBe("Test Person");
    expect(stored.id).toBeTruthy();
    expect(stored.timestamp).toBeTruthy();
  });

  it("emails both the person and the therapist", async () => {
    await POST(post(valid));
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const recipients = sendEmail.mock.calls.map((c) => c[0].to);
    expect(recipients).toContain("test@example.com");
  });

  it("still succeeds when the confirmation email fails — the record is safe", async () => {
    sendEmail.mockResolvedValue({ sent: false, error: "provider down" });
    const res = await POST(post(valid));
    expect(res.status).toBe(200);
    expect(addSubmission).toHaveBeenCalledTimes(1);
  });

  it("fails loudly and does not claim success when storage fails", async () => {
    addSubmission.mockRejectedValue(new Error("blob exploded"));
    const res = await POST(post(valid));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.success).toBeUndefined();
    expect(body.ref).toBeTruthy();
  });

  it("refuses the student rate without confirmation, and stores nothing", async () => {
    const res = await POST(post({ ...valid, slidingScale: "₹600 (Student)" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/student/i);
    expect(addSubmission).not.toHaveBeenCalled();
  });

  it("accepts the student rate once confirmed and records the confirmation", async () => {
    const res = await POST(
      post({ ...valid, slidingScale: "₹600 (Student)", studentConfirmed: true })
    );
    expect(res.status).toBe(200);
    expect(addSubmission.mock.calls[0][0].studentConfirmed).toBe(true);
  });

  it("never marks a paid rate as a student confirmation", async () => {
    await POST(post({ ...valid, studentConfirmed: true }));
    expect(addSubmission.mock.calls[0][0].studentConfirmed).toBe(false);
  });

  it("rejects a cross-origin post with a reference", async () => {
    const res = await POST(post(valid, { origin: "https://evil.example" }));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.ref).toBeTruthy();
    expect(addSubmission).not.toHaveBeenCalled();
  });

  it("rejects a request the bot check refuses", async () => {
    isLikelyBot.mockResolvedValue(true);
    const res = await POST(post(valid));
    expect(res.status).toBe(403);
    expect(addSubmission).not.toHaveBeenCalled();
  });

  it("returns a usable message and reference on validation failure", async () => {
    const res = await POST(post({ ...valid, email: "not-an-email" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/email/i);
    expect(body.ref).toBeTruthy();
  });

  it("rejects malformed JSON rather than throwing", async () => {
    const res = await POST(post("{not json"));
    expect(res.status).toBe(400);
  });

  it("rate-limits a single source and says so", async () => {
    const ip = "203.0.113.77";
    const results = [];
    for (let i = 0; i < 12; i++) {
      results.push((await POST(post(valid, { "x-forwarded-for": ip }))).status);
    }
    expect(results.filter((s) => s === 200).length).toBe(10);
    expect(results.at(-1)).toBe(429);
  });
});
