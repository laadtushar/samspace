import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPasswordHash,
  passwordProblem,
  generateLoginCode,
  generateInviteToken,
  hashSecret,
  secretsMatch,
  MIN_PASSWORD_LENGTH,
} from "@/lib/password";

/**
 * The pure half of the credential handling.
 *
 * Nothing here touches a database, so these run everywhere. What they assert is
 * the part that is easy to get subtly wrong and impossible to notice: that a
 * hash is salted, that a corrupt hash refuses rather than throws, and that a
 * digest of a six-digit code is not reproducible without the key.
 */

describe("password hashing", () => {
  it("accepts the password it was given", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPasswordHash("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a different password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPasswordHash("correct horse battery stapl", stored)).toBe(false);
    expect(await verifyPasswordHash("", stored)).toBe(false);
  });

  it("never stores the password itself", async () => {
    const stored = await hashPassword("hunter2-hunter2-hunter2");
    expect(stored).not.toContain("hunter2");
  });

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword("the same password");
    const b = await hashPassword("the same password");
    expect(a).not.toBe(b);
    // Both still verify — different salt, same password.
    expect(await verifyPasswordHash("the same password", a)).toBe(true);
    expect(await verifyPasswordHash("the same password", b)).toBe(true);
  });

  it("records the cost parameters alongside the hash so they can be raised later", async () => {
    const stored = await hashPassword("a password long enough");
    const [scheme, n, r, p] = stored.split("$");
    expect(scheme).toBe("scrypt");
    expect(Number(n)).toBeGreaterThanOrEqual(16384);
    expect(Number(r)).toBeGreaterThan(0);
    expect(Number(p)).toBeGreaterThan(0);
  });

  it("refuses a malformed or unknown hash instead of throwing", async () => {
    for (const bad of [
      "",
      "not-a-hash",
      "scrypt$1$2$3",
      "bcrypt$32768$8$1$c2FsdA==$aGFzaA==",
      "scrypt$32768$8$1$c2FsdA==$",
      "scrypt$x$y$z$c2FsdA==$aGFzaA==",
    ]) {
      await expect(verifyPasswordHash("anything", bad)).resolves.toBe(false);
    }
    await expect(verifyPasswordHash("anything", null)).resolves.toBe(false);
    await expect(verifyPasswordHash(undefined, "scrypt$32768$8$1$c2FsdA==$aGFzaA==")).resolves.toBe(false);
  });
});

describe("password policy", () => {
  it("requires a real length", () => {
    expect(passwordProblem("short")).toContain(String(MIN_PASSWORD_LENGTH));
    expect(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("rejects non-strings, whitespace-only, and absurd lengths", () => {
    expect(passwordProblem(undefined)).toBeTruthy();
    expect(passwordProblem(12345678901234)).toBeTruthy();
    expect(passwordProblem(" ".repeat(20))).toBeTruthy();
    expect(passwordProblem("a".repeat(500))).toBeTruthy();
  });
});

describe("login codes", () => {
  it("is always six digits, including when the value is small", () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateLoginCode()).toMatch(/^\d{6}$/);
    }
  });

  it("covers the whole range rather than clustering", () => {
    // A modulus bug would starve the top of the range; 500 draws from a
    // million values should still land above and below the midpoint.
    const codes = Array.from({ length: 500 }, () => Number(generateLoginCode()));
    expect(Math.max(...codes)).toBeGreaterThan(500_000);
    expect(Math.min(...codes)).toBeLessThan(500_000);
  });

  it("does not repeat itself in any practical way", () => {
    const seen = new Set(Array.from({ length: 200 }, generateLoginCode));
    expect(seen.size).toBeGreaterThan(180);
  });
});

describe("invite tokens", () => {
  it("is long, url-safe and unique", () => {
    const tokens = Array.from({ length: 100 }, generateInviteToken);
    expect(new Set(tokens).size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(40);
    }
  });
});

describe("keyed digests for short secrets", () => {
  it("is stable for the same key", () => {
    expect(hashSecret("123456", "key")).toBe(hashSecret("123456", "key"));
  });

  it("changes completely with the key, so the database alone reveals nothing", () => {
    // This is the whole point: six digits is a million guesses, so an unkeyed
    // digest of a code is reversible in seconds by whoever reads the table.
    expect(hashSecret("123456", "key-one")).not.toBe(hashSecret("123456", "key-two"));
  });

  it("differs between codes", () => {
    expect(hashSecret("123456", "key")).not.toBe(hashSecret("123457", "key"));
  });
});

describe("digest comparison", () => {
  it("matches identical digests and rejects everything else", () => {
    const digest = hashSecret("123456", "key");
    expect(secretsMatch(digest, digest)).toBe(true);
    expect(secretsMatch(digest, hashSecret("654321", "key"))).toBe(false);
  });

  it("rejects empty and differently-sized input rather than throwing", () => {
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch("aa", "aabb")).toBe(false);
    expect(secretsMatch("zz", "zz")).toBe(false); // not hex — decodes to empty
  });
});
