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

const recordSubmission = vi.fn();
const sendEmail = vi.fn();
const isLikelyBot = vi.fn();

/*
  Whether a database is configured is a decision of the route's, so the test
  states it rather than inheriting it. Every test file shares one process and
  the database suites set DATABASE_URL without clearing it, so reading the real
  environment here would make these results depend on file order — and, worse,
  would run recordSubmission against a real database from a route test.
*/
let databaseConfigured = true;

/*
  Content is read through the same cached accessor the public pages use, which
  needs a Next request context to run. Stubbed here with the real shipped
  content, so the rate check is tested against a real scale rather than a
  fixture that could drift from it.
*/
const siteContent = vi.fn();

vi.mock("@/lib/content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content")>();
  return {
    ...actual,
    getCachedContent: () => siteContent(),
  };
});
vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  dbConfigured: () => databaseConfigured,
}));
vi.mock("@/lib/practice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/practice")>()),
  recordSubmission: (...a: unknown[]) => recordSubmission(...a),
}));
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
  siteContent.mockReset().mockImplementation(async () => {
    const { defaultContent, resolveContentTokens } = await import("@/lib/content");
    return resolveContentTokens(defaultContent);
  });
  databaseConfigured = true;
  recordSubmission.mockReset().mockResolvedValue("client-1");
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
    expect(recordSubmission).toHaveBeenCalledTimes(1);

    const stored = recordSubmission.mock.calls[0][0];
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
    expect(recordSubmission).toHaveBeenCalledTimes(1);
  });

  it("fails loudly and does not claim success when the store refuses", async () => {
    /*
      There is one store now. Telling someone their enquiry arrived when it did
      not is worse than asking them to try again, so a failed write fails the
      request rather than being logged and swallowed.
    */
    recordSubmission.mockRejectedValue(new Error("database down"));
    const res = await POST(post(valid));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBeUndefined();
    expect(body.ref).toBeTruthy();
  });

  it("refuses rather than accepting an enquiry with nowhere to put it", async () => {
    // No database configured is not "saved somewhere else" — it is nowhere.
    // Reporting success would lose the enquiry and tell the person it arrived.
    databaseConfigured = false;
    const res = await POST(post(valid));

    expect(res.status).toBe(500);
    expect(recordSubmission).not.toHaveBeenCalled();
  });

  it("records every field of the submission, not a reduced copy", async () => {
    // What made one store sufficient: the row carries everything the archive
    // used to, so nothing is lost by there no longer being a second copy.
    await POST(post(valid));
    const stored = recordSubmission.mock.calls[0][0];

    expect(stored.email).toBe("test@example.com");
    expect(stored.concerns).toBe(valid.concerns);
    expect(stored.slidingScale).toBe("₹800");
    expect(stored.timestamp).toBeTruthy();
    expect(stored.id).toBeTruthy();
  });

  it("refuses the student rate without confirmation, and stores nothing", async () => {
    const res = await POST(post({ ...valid, slidingScale: "₹500 (Student)" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/student/i);
    expect(recordSubmission).not.toHaveBeenCalled();
  });

  it("accepts the student rate once confirmed and records the confirmation", async () => {
    const res = await POST(
      post({ ...valid, slidingScale: "₹500 (Student)", studentConfirmed: true })
    );
    expect(res.status).toBe(200);
    expect(recordSubmission.mock.calls[0][0].studentConfirmed).toBe(true);
  });

  it("never marks a paid rate as a student confirmation", async () => {
    await POST(post({ ...valid, studentConfirmed: true }));
    expect(recordSubmission.mock.calls[0][0].studentConfirmed).toBe(false);
  });

  it("rejects a cross-origin post with a reference", async () => {
    const res = await POST(post(valid, { origin: "https://evil.example" }));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.ref).toBeTruthy();
    expect(recordSubmission).not.toHaveBeenCalled();
  });

  it("rejects a request the bot check refuses", async () => {
    isLikelyBot.mockResolvedValue(true);
    const res = await POST(post(valid));
    expect(res.status).toBe(403);
    expect(recordSubmission).not.toHaveBeenCalled();
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

/**
 * The rate someone says they are paying has to be one that is offered.
 *
 * It used to be free text — the schema took any string up to sixty characters —
 * so a request that skipped the form could name any figure and have it recorded,
 * emailed and treated as agreed. Survivable while every rate was rupees and a
 * person read the email; not survivable once an amount can mean different things
 * in different places.
 */
describe("the chosen rate is one the practice offers", () => {
  it("accepts a rate on the scale", async () => {
    const res = await POST(post({ ...valid, slidingScale: "₹900" }));
    expect(res.status).toBe(200);
  });

  it("refuses a figure nobody is charging", async () => {
    const res = await POST(post({ ...valid, slidingScale: "₹50" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: expect.stringContaining("not one currently offered"),
    });
    expect(recordSubmission).not.toHaveBeenCalled();
  });

  it("refuses a rate that is merely close to a real one", async () => {
    // "₹800" is offered; "₹8000" and "₹80" are not, and a substring check would
    // have let at least one of them through.
    for (const rate of ["₹8000", "₹80", "₹800 (Student)", "800"]) {
      const res = await POST(post({ ...valid, slidingScale: rate }));
      expect(res.status, rate).toBe(400);
    }
  });

  it("refuses the student rate claimed without its confirmation", async () => {
    // Unchanged behaviour, retested here because the rate check runs first now
    // and must not have swallowed it.
    const res = await POST(
      post({ ...valid, slidingScale: "₹500 (Student)", studentConfirmed: false })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: expect.stringContaining("student status"),
    });
  });

  it("accepts the student rate with it", async () => {
    const res = await POST(
      post({ ...valid, slidingScale: "₹500 (Student)", studentConfirmed: true })
    );
    expect(res.status).toBe(200);
  });

  it("does not refuse a booking because content could not be read", async () => {
    /*
      A deliberate trade. If the scale cannot be read the check cannot run, and
      turning every booking away because storage hiccuped is the wrong failure
      on this route — the origin check, the schema, the rate limit and the
      student confirmation all still apply.
    */
    siteContent.mockRejectedValue(new Error("blob unavailable"));
    const res = await POST(post({ ...valid, slidingScale: "₹777" }));
    expect(res.status).toBe(200);
  });

  it("does not refuse a booking when the scale is empty", async () => {
    siteContent.mockResolvedValue({ slidingScale: [] });
    const res = await POST(post({ ...valid, slidingScale: "₹777" }));
    expect(res.status).toBe(200);
  });
});
