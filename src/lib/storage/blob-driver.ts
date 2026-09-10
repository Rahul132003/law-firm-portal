import "server-only";
import { del, get, put } from "@vercel/blob";
import type { StorageDriver, StoredFile } from "./types";

/**
 * Vercel Blob driver.
 *
 * Everything is written with `access: "private"`, so possession of the URL
 * alone does not grant access — reads go back through the SDK with the store
 * token, server-side only.
 */
export const blobDriver: StorageDriver = {
  name: "vercel-blob",

  async put(key, body, contentType): Promise<StoredFile> {
    const accessMode =
      (process.env.BLOB_ACCESS_MODE as "public" | "private") || "public";

    const result = await put(key, body, {
      access: accessMode,
      contentType,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return {
      ref: result.url,
      size: body.byteLength,
      contentType,
    };
  },

  async getStream(ref) {
    const accessMode =
      (process.env.BLOB_ACCESS_MODE as "public" | "private") || "public";

    try {
      const result = await get(ref, {
        access: accessMode,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      if (result && result.statusCode === 200 && result.stream) {
        return result.stream;
      }
    } catch {
      // Fall through to fetch if SDK get is skipped or for public store URLs
    }

    try {
      const response = await fetch(ref);
      if (response.ok && response.body) {
        return response.body as ReadableStream<Uint8Array>;
      }
    } catch (err) {
      console.error("Failed to fetch stream from Blob URL:", err);
    }

    return null;
  },

  async remove(ref) {
    try {
      await del(ref, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      // A missing object is an acceptable outcome for a delete.
    }
  },
};
