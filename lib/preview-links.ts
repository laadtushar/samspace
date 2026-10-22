import { createHash, randomBytes } from "crypto";
import { safeEqual } from "@/lib/auth";
import { sql, dbConfigured } from "@/lib/db";

/**
 * Shareable preview links.
 *
 * A link lets someone without a dashboard account read one draft. The link is
 * the credential, so it is handled like a password reset token:
 *
 *   - 32 random bytes, so it cannot be guessed or enumerated;
 *   - only a SHA-256 of it is stored, so the table cannot be turned back into
 *     working links;
 *   - looked up by a separate, non-secret id and then compared in constant
 *     time, so how long a check takes says nothing about how close a guess was;
 *   - always expiring, and revocable before then.
 *
 * The URL carries both halves as `<id>.<token>`. Neither alphabet (a UUID, and
 * base64url) contains a dot, so the split is unambiguous.
 */

/** Bytes of randomness in a token. 32 is 256 bits — beyond any guessing. */
export const PREVIEW_TOKEN_BYTES = 32;

/**
 * How long a new link works for, unless the dashboard asks for something else.
 * Two weeks is long enough for a supervisor to get round to reading a draft,
 * and short enough that a link forwarded on and forgotten stops working.
 */
export const PREVIEW_LINK_TTL_DAYS = 14;

/** The longest a link may be asked to last. */
export const PREVIEW_LINK_MAX_DAYS = 90;

/** Where a link is opened. The route lives under /preview with the others. */
export const PREVIEW_LINK_PREFIX = "/preview/link/";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PreviewKind = "page" | "post";

/** A link as the dashboard sees it. Never carries the token or its hash. */
export interface PreviewLink {
  id: string;
  kind: PreviewKind;
  targetId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string;
  createdBy: string;
}

export type PreviewLinkState = "active" | "expired" | "revoked";

/** A fresh token: 32 random bytes, URL-safe. */
export function generatePreviewToken(): string {
  return randomBytes(PREVIEW_TOKEN_BYTES).toString("base64url");
}

/** What is stored in place of a token. */
export function hashPreviewToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// 32 bytes of base64url without padding is exactly 43 characters.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** The path segment a link is opened with. */
export function previewKey(id: string, token: string): string {
  return `${id}.${token}`;
}

/** The site-relative URL for a link. The dashboard prefixes its own origin. */
export function previewPath(id: string, token: string): string {
  return `${PREVIEW_LINK_PREFIX}${previewKey(id, token)}`;
}

/**
 * Splits a key back into its halves, or null if it is not shaped like one.
 * Checked before the database is asked, so junk in the URL costs nothing.
 */
export function parsePreviewKey(key: string): { id: string; token: string } | null {
  const cut = key.indexOf(".");
  if (cut <= 0) return null;
  const id = key.slice(0, cut);
  const token = key.slice(cut + 1);
  if (!ID_PATTERN.test(id) || !TOKEN_PATTERN.test(token)) return null;
  return { id, token };
}

/** Whether a link would open right now. */
export function linkState(
  link: Pick<PreviewLink, "expiresAt" | "revokedAt">,
  now: Date = new Date()
): PreviewLinkState {
  if (link.revokedAt) return "revoked";
  if (new Date(link.expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}

/** A requested lifetime, clamped to what is allowed; the default when absent. */
export function linkLifetimeDays(requested: unknown): number {
  const n = typeof requested === "number" ? requested : Number(requested);
  if (requested === undefined || requested === null || !Number.isFinite(n)) {
    return PREVIEW_LINK_TTL_DAYS;
  }
  return Math.min(PREVIEW_LINK_MAX_DAYS, Math.max(1, Math.round(n)));
}

function rowToLink(r: Record<string, unknown>): PreviewLink {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : "");
  return {
    id: String(r.id),
    kind: r.target_kind === "post" ? "post" : "page",
    targetId: String(r.target_id),
    createdAt: iso(r.created_at),
    expiresAt: iso(r.expires_at),
    revokedAt: iso(r.revoked_at),
    createdBy: (r.created_by as string) ?? "",
  };
}

function requireDb(): void {
  if (!dbConfigured()) {
    throw new Error("No database configured — set DATABASE_URL to share previews.");
  }
}

/**
 * Makes a link. The token is returned here and nowhere else: once this
 * response is gone, the only copy is whatever the person who made it copied.
 */
export async function createPreviewLink(options: {
  kind: PreviewKind;
  targetId: string;
  createdBy: string;
  days?: number;
  now?: Date;
}): Promise<{ link: PreviewLink; token: string; path: string }> {
  requireDb();
  const now = options.now ?? new Date();
  const id = crypto.randomUUID();
  const token = generatePreviewToken();
  const expiresAt = new Date(now.getTime() + linkLifetimeDays(options.days) * DAY_MS);

  const rows = await sql().query(
    `insert into preview_links (id, token_hash, target_kind, target_id,
                                created_at, expires_at, created_by)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, target_kind, target_id, created_at, expires_at, revoked_at, created_by`,
    [
      id,
      hashPreviewToken(token),
      options.kind,
      options.targetId,
      now.toISOString(),
      expiresAt.toISOString(),
      options.createdBy,
    ]
  );

  return { link: rowToLink(rows[0]), token, path: previewPath(id, token) };
}

/** Every link made for one draft, newest first, including ones that have stopped working. */
export async function listPreviewLinks(
  kind: PreviewKind,
  targetId: string
): Promise<PreviewLink[]> {
  if (!dbConfigured()) return [];
  const rows = await sql().query(
    `select id, target_kind, target_id, created_at, expires_at, revoked_at, created_by
       from preview_links
      where target_kind = $1 and target_id = $2
      order by created_at desc`,
    [kind, targetId]
  );
  return rows.map(rowToLink);
}

/**
 * Turns a link off. True if a working link was revoked; false if there was no
 * such link or it was already off. The first revocation time is kept.
 */
export async function revokePreviewLink(id: string, now: Date = new Date()): Promise<boolean> {
  requireDb();
  const rows = await sql().query(
    `update preview_links set revoked_at = $2
      where id = $1 and revoked_at is null
      returning id`,
    [id, now.toISOString()]
  );
  return rows.length > 0;
}

/**
 * What a key opens, or null.
 *
 * Every way of failing — malformed, unknown id, wrong token, expired, revoked —
 * comes back as the same null, and the route turns that into the same 404.
 * Telling them apart would tell a stranger which links exist.
 */
export async function resolvePreviewKey(
  key: string,
  now: Date = new Date()
): Promise<PreviewLink | null> {
  const parts = parsePreviewKey(key);
  if (!parts || !dbConfigured()) return null;

  const rows = await sql().query(
    `select id, token_hash, target_kind, target_id, created_at, expires_at,
            revoked_at, created_by
       from preview_links where id = $1 limit 1`,
    [parts.id]
  );
  const row = rows[0];
  // Hash and compare even when there is no row, so an unknown id takes as long
  // to refuse as a wrong token does.
  const stored = typeof row?.token_hash === "string" ? row.token_hash : "";
  const matches = safeEqual(hashPreviewToken(parts.token), stored);
  if (!row || !matches) return null;

  const link = rowToLink(row);
  return linkState(link, now) === "active" ? link : null;
}
