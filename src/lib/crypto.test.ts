import { createCipheriv, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const newKey = () => randomBytes(32).toString("base64");

// crypto.ts caches keys at module scope, so each test gets a fresh import.
async function loadCrypto(key = newKey(), previous?: string) {
  vi.resetModules();
  vi.stubEnv("FIELD_ENCRYPTION_KEY", key);
  vi.stubEnv("FIELD_ENCRYPTION_KEY_PREVIOUS", previous ?? "");
  return import("./crypto");
}

/** The pre-rotation v1 format, as still stored in existing databases. */
function sealV1(plaintext: string, keyB64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => p.toString("base64")).join(".");
}

describe("field encryption", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips plaintext, including unicode", async () => {
    const { encryptField, decryptField } = await loadCrypto();
    const text = "Strategy: press for adjournment — धारा 138";
    expect(decryptField(encryptField(text))).toBe(text);
  });

  it("uses a fresh IV, so equal plaintexts never produce equal ciphertexts", async () => {
    const { encryptField } = await loadCrypto();
    expect(encryptField("same")).not.toBe(encryptField("same"));
  });

  it("emits the v2 envelope with a key id and never contains the plaintext", async () => {
    const { encryptField } = await loadCrypto();
    const sealed = encryptField("confidential");
    const parts = sealed.split(".");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe("v2");
    expect(parts[1]).toMatch(/^[0-9a-f]{8}$/);
    expect(sealed).not.toContain("confidential");
  });

  it("rejects tampered ciphertext", async () => {
    const { encryptField, decryptField } = await loadCrypto();
    const parts = encryptField("do not alter").split(".");
    const flipped = Buffer.from(parts[4]!, "base64");
    flipped[0] = flipped[0]! ^ 0xff;
    parts[4] = flipped.toString("base64");
    expect(() => decryptField(parts.join("."))).toThrow();
  });

  it("rejects malformed envelopes", async () => {
    const { decryptField } = await loadCrypto();
    expect(() => decryptField("plain text")).toThrow(/Malformed/);
    expect(() => decryptField("v2.a.b.c")).toThrow(/Malformed/);
    expect(() => decryptField("v3.a.b.c.d")).toThrow(/Malformed/);
  });

  it("safeDecryptField degrades instead of throwing on an unknown key", async () => {
    const { encryptField } = await loadCrypto();
    const sealed = encryptField("old key data");
    const { safeDecryptField } = await loadCrypto();
    expect(safeDecryptField(sealed)).toMatch(/unreadable/);
    expect(safeDecryptField(null)).toBe("");
  });

  it("refuses a key of the wrong length", async () => {
    const { encryptField } = await loadCrypto(randomBytes(16).toString("base64"));
    expect(() => encryptField("x")).toThrow(/32 bytes/);
  });

  it("safeCompare checks equality, including different lengths", async () => {
    const { safeCompare } = await loadCrypto();
    expect(safeCompare("secret", "secret")).toBe(true);
    expect(safeCompare("secret", "secreT")).toBe(false);
    expect(safeCompare("secret", "secret-longer")).toBe(false);
  });
});

describe("key rotation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("still reads legacy v1 values under the same key", async () => {
    const key = newKey();
    const { decryptField } = await loadCrypto(key);
    expect(decryptField(sealV1("legacy note", key))).toBe("legacy note");
  });

  it("reads v2 and v1 values sealed with a previous key", async () => {
    const oldKey = newKey();
    const { encryptField: sealOld } = await loadCrypto(oldKey);
    const oldV2 = sealOld("written before rotation");
    const oldV1 = sealV1("written long ago", oldKey);

    const { decryptField, encryptField } = await loadCrypto(newKey(), oldKey);
    expect(decryptField(oldV2)).toBe("written before rotation");
    expect(decryptField(oldV1)).toBe("written long ago");
    // New writes use the new key, not the previous one.
    expect(encryptField("x").split(".")[1]).not.toBe(oldV2.split(".")[1]);
  });

  it("accepts several comma-separated previous keys", async () => {
    const [a, b] = [newKey(), newKey()];
    const { encryptField: sealA } = await loadCrypto(a);
    const fromA = sealA("from a");
    const { decryptField } = await loadCrypto(newKey(), ` ${b} , ${a} `);
    expect(decryptField(fromA)).toBe("from a");
  });

  it("fails once a previous key is removed from configuration", async () => {
    const oldKey = newKey();
    const { encryptField: sealOld } = await loadCrypto(oldKey);
    const sealed = sealOld("orphaned");
    const { decryptField } = await loadCrypto(newKey());
    expect(() => decryptField(sealed)).toThrow(/No configured key/);
  });
});
