import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  randomInt,
  createHmac,
  type ScryptOptions,
} from "crypto";

/**
 * Password hashing, and the short-lived secrets the login flow issues.
 *
 * Passwords are hashed with scrypt, which is deliberately slow and memory-hard,
 * so a stolen copy of admin_users is not a list of passwords. The parameters
 * are stored alongside each hash rather than assumed, so they can be raised
 * later without invalidating every existing password.
 *
 * Nothing here is hand-rolled cryptography: scrypt and HMAC-SHA256 come from
 * Node's crypto module. What this file adds is the encoding around them, and
 * the rule that every comparison is constant-time.
 */

/**
 * scrypt as a promise.
 *
 * Written out rather than promisified because promisify drops the overload
 * that takes an options object, and the options are the entire point — the
 * cost parameters are what make a stolen hash expensive to attack.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

// N must be a power of two. 2^15 is roughly 100ms on the build machines, which
// is a reasonable ceiling for a login that also has to send an email.
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** The shortest password accepted. Length beats character classes. */
export const MIN_PASSWORD_LENGTH = 12;

/** Explains why a password is unacceptable, or null when it is fine. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string") return "Password is required";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > 200) return "Password must be under 200 characters";
  if (password.trim().length === 0) return "Password cannot be only spaces";
  return null;
}

/** Hashes a password for storage. Never store the result of anything else. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    // scrypt's default maxmem is too small for N this large; give it room.
    maxmem: 256 * 1024 * 1024,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Checks a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed or unknown hash: a corrupt
 * row should refuse the login, not crash the endpoint into a 500 that tells an
 * attacker they found something interesting.
 */
export async function verifyPasswordHash(
  password: unknown,
  stored: string | null | undefined
): Promise<boolean> {
  if (typeof password !== "string" || !stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const cost = Number(n);
  const blockSize = Number(r);
  const parallelism = Number(p);
  if (!Number.isFinite(cost) || !Number.isFinite(blockSize) || !Number.isFinite(parallelism)) {
    return false;
  }

  let expected: Buffer;
  try {
    expected = Buffer.from(hashB64, "base64");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  try {
    const derived = await scryptAsync(
      password,
      Buffer.from(saltB64, "base64"),
      expected.length,
      { N: cost, r: blockSize, p: parallelism, maxmem: 256 * 1024 * 1024 }
    );
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * A six-digit second-factor code.
 *
 * randomInt is the CSPRNG, not Math.random, and the range is chosen so every
 * value from 000000 to 999999 is equally likely — taking a modulus of a larger
 * random number would quietly favour the low end.
 */
export function generateLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** A single-use invitation token. 32 bytes, so guessing it is not a strategy. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Keyed digest for short secrets — login codes and invite tokens.
 *
 * Keyed rather than a bare SHA-256 because a six-digit code has only a million
 * possible values: an unkeyed digest of one is reversed by a laptop in a
 * second. The key lives in the environment, so reading the database is not
 * enough on its own.
 */
export function hashSecret(secret: string, key: string): string {
  return createHmac("sha256", key).update(secret).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}
