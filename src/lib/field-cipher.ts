import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM field envelopes, with key rotation.
 *
 * Deliberately free of `server-only` and of environment access, so the key
 * rotation script can share exactly this code. The app goes through
 * src/lib/crypto.ts, which supplies keys from the environment.
 *
 * Formats:
 *   v2.<keyId>.<iv>.<authTag>.<ciphertext>   written today
 *   v1.<iv>.<authTag>.<ciphertext>           legacy, no key id
 *
 * `keyId` is a short, non-secret fingerprint of the key, so a reader can pick
 * the right key directly. Legacy v1 values are tried against every configured
 * key; GCM's auth tag makes a wrong key fail loudly rather than decode garbage.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the GCM standard
export const KEY_LENGTH = 32; // AES-256

export type FieldKey = { id: string; bytes: Buffer };

export function parseKey(base64: string): FieldKey {
  const bytes = Buffer.from(base64.trim(), "base64");
  if (bytes.length !== KEY_LENGTH) {
    throw new Error(
      `Field encryption keys must decode to ${KEY_LENGTH} bytes, got ${bytes.length}. ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return {
    id: createHash("sha256").update(bytes).digest("hex").slice(0, 8),
    bytes,
  };
}

/** Parses a comma-separated list of base64 keys, ignoring blanks. */
export function parseKeyList(value: string | undefined): FieldKey[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseKey);
}

export function seal(plaintext: string, key: FieldKey): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key.bytes, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    "v2",
    key.id,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

function open(key: FieldKey, iv: string, tag: string, data: string): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    key.bytes,
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Opens an envelope with whichever of `keys` sealed it. Throws if the
 * envelope is malformed, no key matches, or the auth tag fails.
 */
export function unseal(envelope: string, keys: FieldKey[]): string {
  const parts = envelope.split(".");

  if (parts[0] === "v2" && parts.length === 5) {
    const [, keyId, iv, tag, data] = parts as [string, string, string, string, string];
    const key = keys.find((candidate) => candidate.id === keyId);
    if (!key) {
      throw new Error(`No configured key matches key id ${keyId}`);
    }
    return open(key, iv, tag, data);
  }

  if (parts[0] === "v1" && parts.length === 4) {
    const [, iv, tag, data] = parts as [string, string, string, string];
    for (const key of keys) {
      try {
        return open(key, iv, tag, data);
      } catch {
        // Wrong key for this legacy value; try the next.
      }
    }
    throw new Error("No configured key decrypts this legacy field");
  }

  throw new Error("Malformed encrypted field envelope");
}

/** True when the value is already sealed under `key` in the current format. */
export function isSealedWith(envelope: string, key: FieldKey): boolean {
  return envelope.startsWith(`v2.${key.id}.`);
}
