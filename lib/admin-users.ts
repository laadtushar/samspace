import { sql, dbConfigured } from "@/lib/db";
import {
  hashPassword,
  verifyPasswordHash,
  generateLoginCode,
  generateInviteToken,
  hashSecret,
  secretsMatch,
} from "@/lib/password";

/**
 * Administrator accounts, their sessions, and the two short-lived credentials
 * the login flow issues: the emailed second-factor code and the invitation
 * token.
 *
 * Every function here returns null or false rather than throwing when the thing
 * asked about does not exist. Login code must not be able to distinguish "no
 * such account" from "wrong password" by which branch threw.
 */

export type AdminRole = "owner" | "member";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  created_at: string;
  last_login_at: string | null;
  disabled_at: string | null;
  /** True once an invitation has been accepted and a password chosen. */
  active: boolean;
}

/** How long an emailed code is good for. Long enough to find the mail. */
export const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
/** Guesses allowed against one code before it is burned. */
export const MAX_CODE_ATTEMPTS = 5;
/** How long an invitation link stays usable. */
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000;
/** How long a signed-in browser stays signed in. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * The key that turns short secrets into stored digests.
 *
 * Separate from the password hashes, which carry their own salts. This one has
 * to be stable across deployments or every outstanding code and invitation
 * stops verifying, so it comes from the environment rather than being generated.
 */
function secretKey(): string {
  const key =
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUBMISSIONS_ENCRYPTION_KEY ||
    process.env.ADMIN_PASSWORD;
  if (!key) {
    throw new Error(
      "No admin secret configured — set ADMIN_SESSION_SECRET before using admin accounts."
    );
  }
  return key;
}

function toUser(row: Record<string, unknown>): AdminUser {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role === "owner" ? "owner" : "member",
    created_at: String(row.created_at),
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    disabled_at: row.disabled_at ? String(row.disabled_at) : null,
    active: Boolean(row.password_hash) && !row.disabled_at,
  };
}

/**
 * Whether real accounts have taken over from the shared environment password.
 *
 * Only an account that can actually be signed in to counts — one with a
 * password chosen and not disabled. An invitation that was sent and never
 * accepted must not switch the old password off, or a bounced email would lock
 * everyone out of their own dashboard permanently.
 */
export async function hasUsableAdminUsers(): Promise<boolean> {
  if (!dbConfigured()) return false;
  try {
    const rows = (await sql()`
      select 1 from admin_users
      where password_hash is not null and disabled_at is null
      limit 1
    `) as unknown as unknown[];
    return rows.length > 0;
  } catch {
    // No table yet (migration not applied) means no accounts yet.
    return false;
  }
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  if (!dbConfigured()) return [];
  const rows = await sql()`
    select id, email, name, role, password_hash, created_at, last_login_at, disabled_at
    from admin_users
    order by created_at asc
  `;
  return rows.map(toUser);
}

export async function findAdminByEmail(email: string): Promise<
  (AdminUser & { password_hash: string | null }) | null
> {
  if (!dbConfigured()) return null;
  const rows = await sql()`
    select id, email, name, role, password_hash, created_at, last_login_at, disabled_at
    from admin_users
    where lower(email) = lower(${email.trim()})
    limit 1
  `;
  if (rows.length === 0) return null;
  return {
    ...toUser(rows[0]),
    password_hash: rows[0].password_hash ? String(rows[0].password_hash) : null,
  };
}

export async function findAdminById(id: string): Promise<AdminUser | null> {
  if (!dbConfigured()) return null;
  const rows = await sql()`
    select id, email, name, role, password_hash, created_at, last_login_at, disabled_at
    from admin_users
    where id = ${id}
    limit 1
  `;
  return rows.length > 0 ? toUser(rows[0]) : null;
}

/** Raised when an invitation names an address that already has an account. */
export class DuplicateAdmin extends Error {
  constructor(email: string) {
    super(`${email} already has an account`);
    this.name = "DuplicateAdmin";
  }
}

/**
 * Creates an account with no password and an invitation token.
 *
 * The token is returned once, in the clear, for the email that is about to be
 * sent. Only its digest is stored, so this is the single moment it exists in a
 * readable form — nothing can recover it afterwards, including us.
 */
export async function inviteAdmin(args: {
  email: string;
  name: string;
  role: AdminRole;
}): Promise<{ user: AdminUser; token: string; expiresAt: Date }> {
  const email = args.email.trim();
  const existing = await findAdminByEmail(email);

  // Re-inviting someone who never accepted is a resend, not a duplicate.
  if (existing?.active) throw new DuplicateAdmin(email);

  const userId = existing
    ? existing.id
    : String(
        (
          await sql()`
            insert into admin_users (email, name, role)
            values (${email}, ${args.name.trim()}, ${args.role})
            returning id
          `
        )[0].id
      );

  if (existing) {
    await sql()`
      update admin_users
      set name = ${args.name.trim()}, role = ${args.role}, disabled_at = null
      where id = ${userId}
    `;
    // A fresh invitation replaces any earlier one, so an old link in an old
    // inbox stops working the moment a new one is sent.
    await sql()`delete from admin_invites where user_id = ${userId}`;
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await sql()`
    insert into admin_invites (user_id, token_hash, expires_at)
    values (${userId}, ${hashSecret(token, secretKey())}, ${expiresAt.toISOString()})
  `;

  const user = await findAdminById(userId);
  if (!user) throw new Error("Invited account could not be read back");
  return { user, token, expiresAt };
}

/** The account an unexpired, unaccepted invitation belongs to. */
export async function adminForInviteToken(token: string): Promise<AdminUser | null> {
  if (!dbConfigured() || !token) return null;
  const rows = await sql()`
    select u.id, u.email, u.name, u.role, u.password_hash, u.created_at,
           u.last_login_at, u.disabled_at
    from admin_invites i
    join admin_users u on u.id = i.user_id
    where i.token_hash = ${hashSecret(token, secretKey())}
      and i.accepted_at is null
      and i.expires_at > now()
    limit 1
  `;
  return rows.length > 0 ? toUser(rows[0]) : null;
}

/**
 * Sets the password an invitation was issued for.
 *
 * The first account to accept becomes the owner regardless of what the
 * invitation said, because the alternative is a dashboard whose only
 * administrator cannot manage administrators.
 */
export async function acceptInvite(
  token: string,
  password: string
): Promise<AdminUser | null> {
  const user = await adminForInviteToken(token);
  if (!user) return null;

  const firstEver = !(await hasUsableAdminUsers());
  const role: AdminRole = firstEver ? "owner" : user.role;

  await sql()`
    update admin_users
    set password_hash = ${await hashPassword(password)}, role = ${role}, disabled_at = null
    where id = ${user.id}
  `;
  await sql()`
    update admin_invites set accepted_at = now()
    where user_id = ${user.id} and accepted_at is null
  `;
  return findAdminById(user.id);
}

/** Checks an email and password. Null for every kind of failure. */
export async function authenticate(
  email: unknown,
  password: unknown
): Promise<AdminUser | null> {
  if (typeof email !== "string" || typeof password !== "string") return null;
  const user = await findAdminByEmail(email);
  if (!user || !user.active) {
    // Hash anyway so a missing account does not answer faster than a wrong
    // password, which would turn this endpoint into an account enumerator.
    await verifyPasswordHash(password, null);
    return null;
  }
  const ok = await verifyPasswordHash(password, user.password_hash);
  return ok ? user : null;
}

// ─── Second factor ─────────────────────────────────

/**
 * Issues a fresh code, replacing any outstanding one.
 *
 * Returns the code for the email that is about to go out; only its digest is
 * stored.
 */
export async function issueLoginCode(
  userId: string
): Promise<{ challengeId: string; code: string; expiresAt: Date }> {
  await sql()`delete from admin_login_codes where user_id = ${userId}`;

  const code = generateLoginCode();
  const expiresAt = new Date(Date.now() + LOGIN_CODE_TTL_MS);
  const rows = await sql()`
    insert into admin_login_codes (user_id, code_hash, expires_at)
    values (${userId}, ${hashSecret(code, secretKey())}, ${expiresAt.toISOString()})
    returning id
  `;
  return { challengeId: String(rows[0].id), code, expiresAt };
}

export type CodeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "expired" | "wrong" | "exhausted" };

/**
 * Checks a code against a challenge.
 *
 * A wrong guess increments the counter and the code dies at the limit, so a
 * six-digit secret cannot be walked through. A correct code is consumed
 * immediately: it opens exactly one session.
 */
export async function verifyLoginCode(
  challengeId: string,
  code: unknown
): Promise<CodeResult> {
  if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
    return { ok: false, reason: "wrong" };
  }

  const rows = await sql()`
    select id, user_id, code_hash, attempts, expires_at, consumed_at
    from admin_login_codes
    where id = ${challengeId}
    limit 1
  `;
  if (rows.length === 0) return { ok: false, reason: "expired" };

  const row = rows[0];
  if (row.consumed_at) return { ok: false, reason: "expired" };
  if (new Date(String(row.expires_at)).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (Number(row.attempts) >= MAX_CODE_ATTEMPTS) {
    return { ok: false, reason: "exhausted" };
  }

  if (!secretsMatch(String(row.code_hash), hashSecret(code.trim(), secretKey()))) {
    await sql()`update admin_login_codes set attempts = attempts + 1 where id = ${challengeId}`;
    const spent = Number(row.attempts) + 1;
    return { ok: false, reason: spent >= MAX_CODE_ATTEMPTS ? "exhausted" : "wrong" };
  }

  await sql()`update admin_login_codes set consumed_at = now() where id = ${challengeId}`;
  return { ok: true, userId: String(row.user_id) };
}

// ─── Sessions ──────────────────────────────────────

export interface AdminSessionRow {
  id: string;
  user_id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  user_agent: string | null;
}

export async function createSession(
  userId: string,
  userAgent: string | null
): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const rows = await sql()`
    insert into admin_sessions (user_id, expires_at, user_agent)
    values (${userId}, ${expiresAt.toISOString()}, ${userAgent?.slice(0, 300) ?? null})
    returning id
  `;
  await sql()`update admin_users set last_login_at = now() where id = ${userId}`;
  return String(rows[0].id);
}

/** The account behind a session id, or null if it is revoked, expired or gone. */
export async function userForSession(sessionId: string): Promise<AdminUser | null> {
  if (!dbConfigured() || !sessionId) return null;
  const rows = await sql()`
    select u.id, u.email, u.name, u.role, u.password_hash, u.created_at,
           u.last_login_at, u.disabled_at
    from admin_sessions s
    join admin_users u on u.id = s.user_id
    where s.id = ${sessionId}
      and s.revoked_at is null
      and s.expires_at > now()
      and u.disabled_at is null
      and u.password_hash is not null
    limit 1
  `;
  return rows.length > 0 ? toUser(rows[0]) : null;
}

export async function touchSession(sessionId: string): Promise<void> {
  await sql()`update admin_sessions set last_seen_at = now() where id = ${sessionId}`;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await sql()`
    update admin_sessions set revoked_at = now()
    where id = ${sessionId} and revoked_at is null
  `;
}

/** Ends every session for one account, optionally sparing the current one. */
export async function revokeAllSessions(
  userId: string,
  exceptSessionId?: string
): Promise<number> {
  const rows = await sql()`
    update admin_sessions set revoked_at = now()
    where user_id = ${userId}
      and revoked_at is null
      and expires_at > now()
      and id <> ${exceptSessionId ?? "00000000-0000-0000-0000-000000000000"}
    returning id
  `;
  return rows.length;
}

export async function listSessionsFor(userId: string): Promise<AdminSessionRow[]> {
  if (!dbConfigured()) return [];
  const rows = await sql()`
    select id, user_id, created_at, last_seen_at, expires_at, revoked_at, user_agent
    from admin_sessions
    where user_id = ${userId} and revoked_at is null and expires_at > now()
    order by last_seen_at desc
  `;
  return rows as unknown as AdminSessionRow[];
}

// ─── Management ────────────────────────────────────

/** Raised when a change would leave the dashboard with no one to manage it. */
export class LastOwner extends Error {
  constructor() {
    super("This is the only owner — promote someone else first");
    this.name = "LastOwner";
  }
}

async function otherOwnersExist(exceptUserId: string): Promise<boolean> {
  const rows = (await sql()`
    select 1 from admin_users
    where role = 'owner'
      and disabled_at is null
      and password_hash is not null
      and id <> ${exceptUserId}
    limit 1
  `) as unknown as unknown[];
  return rows.length > 0;
}

export async function setAdminRole(userId: string, role: AdminRole): Promise<AdminUser | null> {
  const user = await findAdminById(userId);
  if (!user) return null;
  if (user.role === "owner" && role !== "owner" && !(await otherOwnersExist(userId))) {
    throw new LastOwner();
  }
  await sql()`update admin_users set role = ${role} where id = ${userId}`;
  return findAdminById(userId);
}

/** Disables or re-enables an account. Disabling ends its sessions immediately. */
export async function setAdminDisabled(
  userId: string,
  disabled: boolean
): Promise<AdminUser | null> {
  const user = await findAdminById(userId);
  if (!user) return null;
  if (disabled && user.role === "owner" && !(await otherOwnersExist(userId))) {
    throw new LastOwner();
  }
  await sql()`
    update admin_users set disabled_at = ${disabled ? new Date().toISOString() : null}
    where id = ${userId}
  `;
  if (disabled) await revokeAllSessions(userId);
  return findAdminById(userId);
}

export async function deleteAdmin(userId: string): Promise<boolean> {
  const user = await findAdminById(userId);
  if (!user) return false;
  if (user.role === "owner" && !(await otherOwnersExist(userId))) throw new LastOwner();
  await sql()`delete from admin_users where id = ${userId}`;
  return true;
}

/**
 * Changes a password after checking the current one.
 *
 * Every other session is ended on success. A password is usually changed
 * because someone fears it is known, and leaving the other sessions signed in
 * would make the change decorative.
 */
export async function changePassword(args: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  keepSessionId?: string;
}): Promise<boolean> {
  const rows = await sql()`
    select password_hash from admin_users where id = ${args.userId} limit 1
  `;
  if (rows.length === 0) return false;
  const ok = await verifyPasswordHash(
    args.currentPassword,
    rows[0].password_hash ? String(rows[0].password_hash) : null
  );
  if (!ok) return false;

  await sql()`
    update admin_users set password_hash = ${await hashPassword(args.newPassword)}
    where id = ${args.userId}
  `;
  await revokeAllSessions(args.userId, args.keepSessionId);
  return true;
}
