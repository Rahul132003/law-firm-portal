import "dotenv/config";
import { defineConfig } from "prisma/config";

/** First non-empty value among the given environment variable names. */
function envUrl(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations must use a DIRECT (non-pooled) connection — never the
    // pgbouncer pooler. Accepts the project's own name and the direct-URL
    // names the Vercel/Neon integration creates (with or without the `DB`
    // custom prefix).
    //
    // Read straight from process.env rather than Prisma's `env()` helper:
    // `env()` throws at config-load time if the var is absent, which breaks
    // `prisma generate` (needs no database URL) on Vercel. `migrate` / `db
    // push` still fail loudly with a clear message when this is empty.
    url: envUrl(
      "DB_URL_NON_POOLING",
      "DB_POSTGRES_URL_NON_POOLING",
      "DB_DATABASE_URL_UNPOOLED",
      "POSTGRES_URL_NON_POOLING",
      "DATABASE_URL_UNPOOLED",
    ),
    // Only needed for local `prisma migrate dev`.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
