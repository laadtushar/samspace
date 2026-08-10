import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "crypto";

/**
 * Envelope encryption for records that must stay confidential at rest.
 *
 * The project's Blob store is configured public at the store level, which
 * cannot be changed after creation — `access: "private"` is rejected outright.
 * Storing mental-health records as plaintext in a public store is not an
 * option, so the confidentiality is moved into the payload: what lands in the
 * store is ciphertext, and the key never leaves the server's environment.
 *
 * AES-256-GCM, random IV per record, authentication tag verified on read, so a
 * tampered object fails to decrypt rather than returning altered data.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const PREFIX = "enc.v1.";

function secret(): string {
  // A dedicated key is preferred. The session secret is accepted as a fallback
  // so an existing deployment keeps working — but note that changing whichever
  // value is in use makes previously stored records unreadable.
  const value =
    process.env.SUBMISSIONS_ENCRYPTION_KEY ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD;
  if (!value) {
    throw new Error(
      "No encryption key available — set SUBMISSIONS_ENCRYPTION_KEY (or ADMIN_SESSION_SECRET)."
    );
  }
  return value;
}

function key(): Buffer {
  // HKDF turns a human-chosen secret into a uniformly random 32-byte key.
  return Buffer.from(
    hkdfSync("sha256", secret(), "samvriti-blob-v1", "record-encryption", 32)
  );
}

/** True when a stored payload was written by this module. */
export function isEncrypted(payload: string): boolean {
  return payload.startsWith(PREFIX);
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString(
    "base64url"
  )}.${ciphertext.toString("base64url")}`;
}

export function decryptJson<T>(payload: string): T {
  // Records written before encryption was introduced are plain JSON. Reading
  // them still works so nothing already stored becomes unreachable.
  if (!isEncrypted(payload)) return JSON.parse(payload) as T;

  const [ivPart, tagPart, dataPart] = payload.slice(PREFIX.length).split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Malformed encrypted record");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
