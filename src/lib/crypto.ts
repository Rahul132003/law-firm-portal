import "server-only";

import { timingSafeEqual } from "node:crypto";
import { env } from "./env";
import {
  parseKey,
  parseKeyList,
  seal,
  unseal,
  type FieldKey,
} from "./field-cipher";

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
 * Key rotation: new writes always use FIELD_ENCRYPTION_KEY. Keys listed in
 * FIELD_ENCRYPTION_KEY_PREVIOUS (comma-separated) are used for reading only,
 * until `npm run crypto:rotate -- --apply` has re-sealed every row. The
 * envelope format lives in ./field-cipher.ts.
 */

let cachedKeys: { current: FieldKey; all: FieldKey[] } | null = null;

function getKeys() {
  if (cachedKeys) return cachedKeys;

  const current = parseKey(env.fieldEncryptionKey);
  const previous = parseKeyList(process.env.FIELD_ENCRYPTION_KEY_PREVIOUS);

  cachedKeys = { current, all: [current, ...previous] };
  return cachedKeys;
}

/** Seals plaintext for storage under the current key. */
export function encryptField(plaintext: string): string {
  return seal(plaintext, getKeys().current);
}

/**
 * Opens a sealed field with the current or any previous key. Throws if the
 * envelope is malformed or the auth tag fails — a tampered or truncated
 * ciphertext must never silently decode.
 */
export function decryptField(envelope: string): string {
  return unseal(envelope, getKeys().all);
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
