import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The endpoint the dashboard sets rates through.
 *
 * Reachable directly by anyone holding an admin session, so what it accepts is
 * decided here. A rate is a number that multiplies every price on the site for
 * a whole country; a bad one is not a cosmetic problem.
 */

const allRates = vi.fn();
const saveRate = vi.fn();
const deleteRate = vi.fn();
let databaseConfigured = true;
let admin: Response | null = null;

vi.mock("@/lib/admin-guard", () => ({ requireAdmin: async () => admin }));
vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  dbConfigured: () => databaseConfigured,
}));
vi.mock("@/lib/fx-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/fx-store")>()),
  allRates: () => allRates(),
  saveRate: (...a: unknown[]) => saveRate(...a),
  deleteRate: (...a: unknown[]) => deleteRate(...a),
}));

const { GET, POST, DELETE } = await import("@/app/api/admin/rates/route");

const post = (body: unknown) =>
  POST(
    new Request("https://example.test/api/admin/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );

const del = (query: string) =>
  DELETE(
    new Request(`https://example.test/api/admin/rates?${query}`, {
      method: "DELETE",
    })
  );

beforeEach(() => {
  allRates.mockReset().mockResolvedValue([]);
  saveRate.mockReset().mockResolvedValue(undefined);
  deleteRate.mockReset().mockResolvedValue(true);
  databaseConfigured = true;
  admin = null;
});

describe("reading the rates", () => {
  it("returns them", async () => {
    allRates.mockResolvedValue([
      { currency: "USD", perRupee: 0.0115, asOf: "", source: "manual", updatedAt: "" },
    ]);
    const body = await (await GET()).json();
    expect(body.rates[0].currency).toBe("USD");
  });

  it("refuses anyone who is not an administrator", async () => {
    admin = new Response("no", { status: 401 });
    expect((await GET()).status).toBe(401);
  });

  it("says so rather than reporting no rates when there is no database", async () => {
    // An empty list reads as "nothing is configured", which would have someone
    // setting rates that go nowhere.
    databaseConfigured = false;
    expect((await GET()).status).toBe(503);
  });
});

describe("setting a rate", () => {
  it("stores it and answers with the new list", async () => {
    allRates.mockResolvedValue([
      { currency: "USD", perRupee: 0.0115, asOf: "", source: "manual", updatedAt: "" },
    ]);
    const res = await post({ currency: "USD", perRupee: 0.0115 });

    expect(res.status).toBe(200);
    expect(saveRate).toHaveBeenCalledWith("USD", 0.0115, "manual");
    expect((await res.json()).rates).toHaveLength(1);
  });

  it("accepts a lower-case code, because that is not a mistake worth refusing", async () => {
    await post({ currency: " usd ", perRupee: "0.0115" });
    expect(saveRate).toHaveBeenCalledWith("USD", 0.0115, "manual");
  });

  it("accepts the number as typed text", async () => {
    // It comes from a text input; demanding a JSON number would fail on the
    // one thing the dashboard actually sends.
    await post({ currency: "AED", perRupee: "0.0425" });
    expect(saveRate).toHaveBeenCalledWith("AED", 0.0425, "manual");
  });

  it("refuses a rate that would price every tier at nothing", async () => {
    for (const perRupee of [0, -1, "", "abc", null]) {
      const res = await post({ currency: "USD", perRupee });
      expect(res.status).toBe(400);
    }
    expect(saveRate).not.toHaveBeenCalled();
  });

  it("refuses something that is not a currency code", async () => {
    expect((await post({ currency: "dollars", perRupee: 1 })).status).toBe(400);
    expect(saveRate).not.toHaveBeenCalled();
  });

  it("refuses the practice's own currency", async () => {
    expect((await post({ currency: "INR", perRupee: 1 })).status).toBe(400);
    expect(saveRate).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const res = await POST(
      new Request("https://example.test/api/admin/rates", {
        method: "POST",
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("refuses anyone who is not an administrator, before reading the body", async () => {
    admin = new Response("no", { status: 401 });
    expect((await post({ currency: "USD", perRupee: 1 })).status).toBe(401);
    expect(saveRate).not.toHaveBeenCalled();
  });

  it("reports a failed write rather than an empty success", async () => {
    saveRate.mockRejectedValue(new Error("database unreachable"));
    const res = await post({ currency: "USD", perRupee: 0.0115 });
    expect(res.status).toBe(500);
  });
});

describe("removing a rate", () => {
  it("removes it and answers with the new list", async () => {
    const res = await del("currency=USD");
    expect(res.status).toBe(200);
    expect(deleteRate).toHaveBeenCalledWith("USD");
  });

  it("says so when there was nothing to remove", async () => {
    deleteRate.mockResolvedValue(false);
    expect((await del("currency=USD")).status).toBe(404);
  });

  it("refuses without a currency", async () => {
    expect((await del("")).status).toBe(400);
    expect(deleteRate).not.toHaveBeenCalled();
  });

  it("refuses anyone who is not an administrator", async () => {
    admin = new Response("no", { status: 401 });
    expect((await del("currency=USD")).status).toBe(401);
    expect(deleteRate).not.toHaveBeenCalled();
  });
});
