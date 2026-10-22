import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  generatePreviewToken,
  hashPreviewToken,
  parsePreviewKey,
  previewKey,
  previewPath,
  linkState,
  linkLifetimeDays,
  PREVIEW_TOKEN_BYTES,
  PREVIEW_LINK_TTL_DAYS,
  PREVIEW_LINK_MAX_DAYS,
  PREVIEW_LINK_PREFIX,
} from "@/lib/preview-links";

/**
 * The parts of a shared preview link that need no database: how the token is
 * made, what is stored in its place, how a URL is taken apart, and when a link
 * stops working. The database half is in tests/pages-store.test.ts.
 */

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("tokens", () => {
  it("carries at least 32 random bytes", () => {
    expect(PREVIEW_TOKEN_BYTES).toBeGreaterThanOrEqual(32);
    const token = generatePreviewToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(PREVIEW_TOKEN_BYTES);
  });

  it("is URL-safe as it stands, with nothing to escape", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePreviewToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 1000 }, generatePreviewToken));
    expect(seen.size).toBe(1000);
  });
});

describe("what is stored instead of the token", () => {
  it("is the SHA-256 of it, in hex", () => {
    const token = generatePreviewToken();
    expect(hashPreviewToken(token)).toBe(
      createHash("sha256").update(token).digest("hex")
    );
    expect(hashPreviewToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable for one token and different for another", () => {
    const a = generatePreviewToken();
    const b = generatePreviewToken();
    expect(hashPreviewToken(a)).toBe(hashPreviewToken(a));
    expect(hashPreviewToken(a)).not.toBe(hashPreviewToken(b));
  });

  it("does not contain the token", () => {
    const token = generatePreviewToken();
    expect(hashPreviewToken(token)).not.toContain(token);
  });
});

describe("the link's URL", () => {
  it("round-trips an id and a token", () => {
    const token = generatePreviewToken();
    expect(parsePreviewKey(previewKey(ID, token))).toEqual({ id: ID, token });
    expect(previewPath(ID, token)).toBe(`${PREVIEW_LINK_PREFIX}${ID}.${token}`);
    expect(PREVIEW_LINK_PREFIX.startsWith("/preview/")).toBe(true);
  });

  it("refuses anything not shaped like a key, before any lookup", () => {
    const token = generatePreviewToken();
    for (const bad of [
      "",
      ".",
      ID,
      token,
      `${ID}.`,
      `.${token}`,
      `${ID}.${token.slice(1)}`,
      `${ID}.${token}x`,
      `${ID.toUpperCase()}.${token}`,
      `not-a-uuid.${token}`,
      `${ID}.${token.slice(0, 42)}=`,
      `${ID}.${token}.${token}`,
      `${ID}.${token.slice(0, 40)}%2F`,
    ]) {
      expect(parsePreviewKey(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("expiry and revocation", () => {
  const now = new Date("2026-10-22T12:00:00Z");

  it("defaults to fourteen days, from a named constant", () => {
    expect(PREVIEW_LINK_TTL_DAYS).toBe(14);
    expect(linkLifetimeDays(undefined)).toBe(PREVIEW_LINK_TTL_DAYS);
    expect(linkLifetimeDays(null)).toBe(PREVIEW_LINK_TTL_DAYS);
    expect(linkLifetimeDays("soon")).toBe(PREVIEW_LINK_TTL_DAYS);
  });

  it("keeps a requested lifetime inside the allowed range", () => {
    expect(linkLifetimeDays(3)).toBe(3);
    expect(linkLifetimeDays(0)).toBe(1);
    expect(linkLifetimeDays(-5)).toBe(1);
    expect(linkLifetimeDays(10_000)).toBe(PREVIEW_LINK_MAX_DAYS);
  });

  it("works until the moment it expires, and not at that moment", () => {
    expect(linkState({ expiresAt: "2026-10-22T12:00:01Z", revokedAt: "" }, now)).toBe("active");
    expect(linkState({ expiresAt: "2026-10-22T12:00:00Z", revokedAt: "" }, now)).toBe("expired");
    expect(linkState({ expiresAt: "2026-10-01T00:00:00Z", revokedAt: "" }, now)).toBe("expired");
  });

  it("is off once revoked, however long it had left", () => {
    expect(
      linkState({ expiresAt: "2027-01-01T00:00:00Z", revokedAt: "2026-10-20T00:00:00Z" }, now)
    ).toBe("revoked");
  });
});
