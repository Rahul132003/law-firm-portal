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
  if (process.env.BLOB_READ_WRITE_TOKEN) return blobDriver;

  // Serverless filesystems are read-only or discarded between invocations, so
  // the local driver in production would lose court filings. Fail loudly.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE !== "true") {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set in production. Connect a Vercel Blob store, " +
        "or set ALLOW_LOCAL_STORAGE=true only for a self-hosted server with a persistent disk.",
    );
  }

  return localDriver;
}
