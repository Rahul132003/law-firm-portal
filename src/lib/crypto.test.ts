import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// crypto.ts caches the key at module scope, so each test gets a fresh import.
async function loadCrypto(key = randomBytes(32).toString("base64")) {
  vi.resetModules();
  vi.stubEnv("FIELD_ENCRYPTION_KEY", key);
  return import("./crypto");
}

describe("field encryption", () => {
  beforeEach(() => vi.unstubAllEnvs());
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

  it("emits the versioned envelope and never contains the plaintext", async () => {
    const { encryptField } = await loadCrypto();
    const sealed = encryptField("confidential");
    expect(sealed.split(".")).toHaveLength(4);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("confidential");
  });

  it("rejects tampered ciphertext", async () => {
    const { encryptField, decryptField } = await loadCrypto();
    const [version, iv, tag, data] = encryptField("do not alter").split(".");
    const flipped = Buffer.from(data!, "base64");
    flipped[0] = flipped[0]! ^ 0xff;
    const tampered = [version, iv, tag, flipped.toString("base64")].join(".");
    expect(() => decryptField(tampered)).toThrow();
  });

  it("rejects malformed envelopes", async () => {
    const { decryptField } = await loadCrypto();
    expect(() => decryptField("plain text")).toThrow(/Malformed/);
    expect(() => decryptField("v2.a.b.c")).toThrow(/Malformed/);
  });

  it("safeDecryptField degrades instead of throwing on a different key", async () => {
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
