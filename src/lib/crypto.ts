import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "./env";

/**
 * Application-level encryption for the highest-risk free-text columns:
 * case strategy notes and hearing notes.
 *
 * PostgreSQL offers no per-column encryption reachable through Prisma, so
 * these fields are sealed here before they reach the database. A leaked
 * database dump or a snapshot restored by an operator therefore does not
 * expose privileged case strategy.
 *
 * Trade-off: encrypted columns cannot be filtered or full-text searched in
 * SQL. Document *metadata* search (module 3) deliberately operates on
 * titles and filenames, which stay in plaintext.
 *
 * Format: v1.<iv-b64>.<authTag-b64>.<ciphertext-b64>
 * The version prefix leaves room to rotate keys or algorithms later.
 */

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12; // 96-bit nonce, the GCM standard
const KEY_LENGTH = 32; // AES-256

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const key = Buffer.from(env.fieldEncryptionKey, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `FIELD_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes, got ${key.length}. ` +
        "Generate one with: openssl rand -base64 32",
    );
  }

  cachedKey = key;
  return key;
}

/** Seals plaintext for storage. Returns the versioned envelope string. */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Opens a sealed field. Throws if the envelope is malformed or the auth tag
 * fails — a tampered or truncated ciphertext must never silently decode.
 */
export function decryptField(envelope: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed encrypted field envelope");
  }

  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64!, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64!, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64!, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Decrypts without throwing, for read paths that render many rows at once.
 * One unreadable note must not blank out an entire case timeline.
 */
export function safeDecryptField(envelope: string | null): string {
  if (!envelope) return "";
  try {
    return decryptField(envelope);
  } catch {
    return "[unreadable — encrypted with a different key]";
  }
}

/** Constant-time comparison for shared secrets (cron tokens, etc.). */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
