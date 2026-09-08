import "server-only";

export type StoredFile = {
  /**
   * Opaque handle used to read the file back later. For Vercel Blob this is
   * the blob URL; for local storage it is a `local:` prefixed relative path.
   * Treated as a secret — never sent to the browser.
   */
  ref: string;
  size: number;
  contentType: string;
};

export interface StorageDriver {
  /** Human-readable name, surfaced in dev diagnostics. */
  readonly name: string;

  put(key: string, body: Buffer, contentType: string): Promise<StoredFile>;

  /** Returns null when the underlying object is missing. */
  getStream(ref: string): Promise<ReadableStream<Uint8Array> | null>;

  /** Must not throw when the object is already gone. */
  remove(ref: string): Promise<void>;
}
