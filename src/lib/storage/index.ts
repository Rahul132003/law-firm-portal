import "server-only";
import { blobDriver } from "./blob-driver";
import { localDriver } from "./local-driver";
import type { StorageDriver } from "./types";
export type { StorageDriver, StoredFile } from "./types";

/**
 * File storage, behind a two-driver interface.
 *
 * Vercel Blob is the deployment target. The local filesystem driver exists so
 * uploads are exercisable in development without a Blob token — selection is
 * purely a function of whether BLOB_READ_WRITE_TOKEN is set, so promoting to
 * real Blob storage is a configuration change, not a code change.
 *
 * Blobs are written with `access: "private"`. A public blob URL would be a
 * capability in its own right and would bypass every case-assignment check in
 * this application, so document bytes are only ever served through
 * /api/documents/[id]/download, which authorises and audits first.
 */
export function getStorage(): StorageDriver {
  return process.env.BLOB_READ_WRITE_TOKEN ? blobDriver : localDriver;
}
