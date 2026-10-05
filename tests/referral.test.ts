import { describe, it, expect } from "vitest";
import { intakeSchema } from "@/lib/validation";
import { REFERRAL_SOURCES, describeReferral, referralLabel } from "@/lib/referral";

const base = {
  name: "Asha", email: "asha@example.com", gender: "Female", age: "24",
  whatsapp: "9999999999", concerns: "Exam stress", slidingScale: "₹800",
};

describe("how did you hear about us", () => {
  it("is optional", () => {
    const parsed = intakeSchema.parse(base);
    expect(parsed.heardFrom).toBe("");
  });

  it("accepts every offered answer", () => {
    for (const { key } of REFERRAL_SOURCES) {
      expect(intakeSchema.parse({ ...base, heardFrom: key }).heardFrom).toBe(key);
    }
  });

  it("refuses an answer that is not on the list", () => {
    expect(intakeSchema.safeParse({ ...base, heardFrom: "<script>" }).success).toBe(false);
  });

  it("bounds the free-text detail", () => {
    const long = "x".repeat(500);
    expect(intakeSchema.safeParse({ ...base, heardFrom: "other", heardFromDetail: long }).success).toBe(false);
  });

  it("keys are unique, so a stored answer can only mean one thing", () => {
    const keys = REFERRAL_SOURCES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("reads back as a label, with detail when given", () => {
    expect(referralLabel("friend")).toBe("A friend or family member");
    expect(describeReferral("other", "Campus poster")).toBe("Somewhere else — Campus poster");
    expect(describeReferral("", "")).toBe("");
  });
});
