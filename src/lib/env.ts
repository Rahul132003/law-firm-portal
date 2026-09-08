import "server-only";

/**
 * Fail fast on missing configuration rather than surfacing a confusing runtime
 * error deep inside a query or an upload.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return value;
}

export const env = {
  get databaseUrl() {
    return required("DB_PRISMA_URL");
  },
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get fieldEncryptionKey() {
    return required("FIELD_ENCRYPTION_KEY");
  },
  get blobToken() {
    return required("BLOB_READ_WRITE_TOKEN");
  },
  get cronSecret() {
    return required("CRON_SECRET");
  },
};
