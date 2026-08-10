import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { cookies } from "next/headers";

/**
 * Admin authentication.
 *
 * Previously the raw password travelled in an `x-admin-password` header on
 * every request, was compared with `!==` (which short-circuits on the first
 * differing byte), and could be guessed an unlimited number of times. It was
 * the only thing standing between the internet and a set of mental-health
 * records.
 *
 * Now: log in once, receive a signed httpOnly cookie with a fixed lifetime, and
 * the password itself is never sent again. Comparisons are constant-time and
 * repeated failures lock the source out.
 */

const COOKIE_NAME = "samvriti_admin";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

/** Compares two strings without leaking where they diverge. */
export function safeEqual(a: string, b: string): boolean {
  // Digesting first gives both sides equal length, so the comparison can't leak
  // the secret's length either.
  const key = randomBytes(32);
  const digest = (v: string) => createHmac("sha256", key).update(v).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function sessionSecret(): string {
  // The password doubles as the signing key: changing it invalidates every
  // outstanding session, which is the behaviour you want from a password change.
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error(
      "ADMIN_PASSWORD is not set — the admin dashboard cannot be used until it is."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

function issueToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(signature, sign(payload))) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

// ─── Brute-force throttle ──────────────────────────
// Per-instance memory. On serverless this is per-warm-instance rather than
// global, so it slows an attacker down without being a hard guarantee. Pair it
// with Vercel Firewall rate limiting on /api/admin/auth for a real ceiling.
const attempts = new Map<string, { count: number; blockedUntil: number }>();

export function loginBlockedFor(key: string): number {
  const record = attempts.get(key);
  if (!record) return 0;
  return Math.max(0, record.blockedUntil - Date.now());
}

export function recordFailedLogin(key: string): void {
  const record = attempts.get(key) ?? { count: 0, blockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = Date.now() + LOCKOUT_MS;
    record.count = 0;
  }
  attempts.set(key, record);
}

export function clearFailedLogins(key: string): void {
  attempts.delete(key);
}

// ─── Session cookie ────────────────────────────────

export function verifyPassword(candidate: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof candidate !== "string") return false;
  return safeEqual(candidate, expected);
}

export function startSession(): void {
  cookies().set(COOKIE_NAME, issueToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function endSession(): void {
  cookies().delete(COOKIE_NAME);
}

/** True when the caller presents a valid, unexpired admin session cookie. */
export function isAuthenticated(): boolean {
  try {
    return isTokenValid(cookies().get(COOKIE_NAME)?.value);
  } catch {
    // sessionSecret() throws when ADMIN_PASSWORD is unset — fail closed.
    return false;
  }
}
