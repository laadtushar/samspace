import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { AdminRole, AdminUser } from "@/lib/admin-users";
import {
  hasUsableAdminUsers,
  userForSession,
  createSession,
  revokeSession,
  SESSION_TTL_MS,
} from "@/lib/admin-users";

/**
 * Admin authentication.
 *
 * There are two ways in, and only ever one of them at a time.
 *
 * Once real accounts exist, signing in means an email address, a password, and
 * a six-digit code sent to that address. The cookie then names a row in
 * admin_sessions, so a session can be ended from the other side — which is what
 * you need when a laptop goes missing, and what a self-contained token cannot
 * give you.
 *
 * Before any account exists there is nobody to email, so the old shared
 * ADMIN_PASSWORD still works. That is the bootstrap, not a fallback: the moment
 * one account has a password and is enabled, the environment password stops
 * being accepted. Keeping it alive alongside real accounts would mean every
 * protection below could be walked around by whoever still had the old secret.
 */

const COOKIE_NAME = "samvriti_admin";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export { SESSION_TTL_MS };

/** Who is making this request. */
export interface AdminIdentity {
  /** Null only for a bootstrap session, which belongs to no account. */
  userId: string | null;
  sessionId: string | null;
  name: string;
  email: string | null;
  role: AdminRole;
  /** True when signed in with the environment password rather than an account. */
  legacy: boolean;
}

/** Compares two strings without leaking where they diverge. */
export function safeEqual(a: string, b: string): boolean {
  // Digesting first gives both sides equal length, so the comparison can't leak
  // the secret's length either.
  const key = randomBytes(32);
  const digest = (v: string) => createHmac("sha256", key).update(v).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function sessionSecret(): string {
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

function setCookie(value: string): void {
  cookies().set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
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

// ─── Bootstrap password ────────────────────────────

/**
 * Whether the environment password is still a way in.
 *
 * False as soon as one account exists that can be signed in to. Checked on
 * every bootstrap login rather than cached, because the answer changes the
 * instant the first invitation is accepted.
 */
export async function legacyLoginAllowed(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return false;
  return !(await hasUsableAdminUsers());
}

export function verifyPassword(candidate: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof candidate !== "string") return false;
  return safeEqual(candidate, expected);
}

export function startLegacySession(): void {
  const payload = `l.${Date.now() + SESSION_TTL_MS}`;
  setCookie(`${payload}.${sign(payload)}`);
}

// ─── Account sessions ──────────────────────────────

export async function startUserSession(
  userId: string,
  userAgent: string | null
): Promise<void> {
  const sessionId = await createSession(userId, userAgent);
  const payload = `u.${sessionId}`;
  setCookie(`${payload}.${sign(payload)}`);
}

/**
 * Reads the cookie and returns who it belongs to, or null.
 *
 * The signature is checked before the database is touched, so a forged or
 * tampered cookie costs a hash rather than a query.
 */
export async function currentAdmin(): Promise<AdminIdentity | null> {
  let raw: string | undefined;
  try {
    raw = cookies().get(COOKIE_NAME)?.value;
  } catch {
    return null;
  }
  if (!raw) return null;

  let identity: AdminIdentity | null = null;
  try {
    identity = await identify(raw);
  } catch {
    // A missing secret, or a database that is briefly unreachable, must fail
    // closed rather than granting access.
    return null;
  }
  return identity;
}

async function identify(raw: string): Promise<AdminIdentity | null> {
  const cut = raw.lastIndexOf(".");
  if (cut <= 0) return null;
  const payload = raw.slice(0, cut);
  const signature = raw.slice(cut + 1);
  if (!safeEqual(signature, sign(payload))) return null;

  if (payload.startsWith("u.")) {
    const sessionId = payload.slice(2);
    const user = await userForSession(sessionId);
    if (!user) return null;
    return {
      userId: user.id,
      sessionId,
      name: user.name,
      email: user.email,
      role: user.role,
      legacy: false,
    };
  }

  // `l.<expiry>` is a bootstrap session. The bare `<expiry>` form is what the
  // previous version of this file issued; it is accepted on the same terms so
  // an upgrade does not sign the practitioner out mid-edit.
  const expiry = payload.startsWith("l.") ? payload.slice(2) : payload;
  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return null;
  if (!(await legacyLoginAllowed())) return null;

  return {
    userId: null,
    sessionId: null,
    name: "Administrator",
    email: null,
    // The bootstrap session must be able to invite the first real account,
    // which is an owner's job.
    role: "owner",
    legacy: true,
  };
}

/** Ends the caller's session: revoked in the database, then cleared here. */
export async function endSession(): Promise<void> {
  const identity = await currentAdmin();
  if (identity?.sessionId) {
    try {
      await revokeSession(identity.sessionId);
    } catch {
      // Clearing the cookie still signs this browser out.
    }
  }
  try {
    cookies().delete(COOKIE_NAME);
  } catch {
    // Nothing to clear.
  }
}

/** True when the caller presents a valid admin session of either kind. */
export async function isAuthenticated(): Promise<boolean> {
  return (await currentAdmin()) !== null;
}

/** Convenience for routes that need the account itself. */
export type { AdminUser };
