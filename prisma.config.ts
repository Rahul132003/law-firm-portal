import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations and introspection must bypass the connection pooler, so the
    // CLI always uses the direct connection. The application runtime uses the
    // pooled URL instead — see src/lib/prisma.ts.
    url: env("DB_URL_NON_POOLING"),
    // Only needed for local `prisma migrate dev`, which builds a throwaway
    // database to diff against. Hosted Postgres providers usually let Prisma
    // create one automatically, so this stays unset in deployment.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
