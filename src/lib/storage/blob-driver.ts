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
    const result = await put(key, body, {
      access: "private",
      contentType,
      // The key already carries a per-document cuid, so a second random
      // suffix would only make the object harder to reconcile.
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
    const result = await get(ref, {
      // Must match how the blob was written, or the read is rejected.
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!result || result.statusCode !== 200) return null;
    return result.stream;
  },

  async remove(ref) {
    try {
      await del(ref, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      // A missing object is an acceptable outcome for a delete.
    }
  },
};
