import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { StorageDriver, StoredFile } from "./types";

/**
 * Development-only filesystem driver, used when BLOB_READ_WRITE_TOKEN is
 * unset. Files land in `.uploads/` at the project root, which is gitignored.
 *
 * This exists so the upload/download/versioning flow can be exercised without
 * a Vercel account. It is not suitable for deployment: serverless filesystems
 * are ephemeral and not shared between instances.
 */

const PREFIX = "local:";
const BASE_DIR = path.join(process.cwd(), ".uploads");

/**
 * Resolves a storage key to an absolute path, refusing anything that escapes
 * the base directory. Keys are constructed server-side, but a traversal check
 * here is cheap and removes the whole class of bug.
 */
function resolveWithinBase(key: string): string {
  const absolute = path.resolve(BASE_DIR, key);
  const base = path.resolve(BASE_DIR);

  if (absolute !== base && !absolute.startsWith(base + path.sep)) {
    throw new Error("Refusing to access a path outside the upload directory.");
  }

  return absolute;
}

function refToKey(ref: string): string {
  if (!ref.startsWith(PREFIX)) {
    throw new Error(`Not a local storage reference: ${ref.slice(0, 24)}…`);
  }
  return ref.slice(PREFIX.length);
}

export const localDriver: StorageDriver = {
  name: "local-filesystem",

  async put(key, body, contentType): Promise<StoredFile> {
    const absolute = resolveWithinBase(key);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, body);

    return {
      ref: `${PREFIX}${key}`,
      size: body.byteLength,
      contentType,
    };
  },

  async getStream(ref) {
    const absolute = resolveWithinBase(refToKey(ref));

    try {
      await stat(absolute);
    } catch {
      return null;
    }

    // Node stream -> web ReadableStream, so both drivers return the same type
    // and the download route does not need to care which is active.
    return Readable.toWeb(
      createReadStream(absolute),
    ) as ReadableStream<Uint8Array>;
  },

  async remove(ref) {
    const absolute = resolveWithinBase(refToKey(ref));
    await rm(absolute, { force: true });
  },
};
