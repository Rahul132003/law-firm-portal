import "server-only";

/**
 * Fail fast on missing configuration rather than surfacing a confusing runtime
 * error deep inside a query or an upload.
 *
 * Each getter accepts more than one variable name: the project's own
 * `DB_PRISMA_URL` etc., and also the names the Vercel Postgres / Neon
 * marketplace integration creates automatically, so a dashboard-connected
 * database works without setting a custom prefix.
 */
function firstOf(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(
    `Missing required environment variable ${names[0]}. See .env.example.`,
  );
}

export const env = {
  /** Pooled connection used by the running app (src/lib/prisma.ts). */
  get databaseUrl() {
    return firstOf(
      "DB_PRISMA_URL",
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL",
      "DATABASE_URL",
    );
  },
  get authSecret() {
    return firstOf("AUTH_SECRET", "NEXTAUTH_SECRET");
  },
  get fieldEncryptionKey() {
    return firstOf("FIELD_ENCRYPTION_KEY");
  },
  get blobToken() {
    return firstOf("BLOB_READ_WRITE_TOKEN");
  },
  get cronSecret() {
    return firstOf("CRON_SECRET");
  },
};
