import "dotenv/config";
import { defineConfig } from "prisma/config";

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
    //
    // Read straight from process.env rather than Prisma's `env()` helper:
    // `env()` throws at config-load time if the var is absent, which breaks
    // `prisma generate` (it needs no database URL) in CI/Vercel where only the
    // runtime vars are set. `migrate` / `db push` still fail loudly with a
    // clear message if this is empty when they actually try to connect.
    url: process.env.DB_URL_NON_POOLING ?? "",
    // Only needed for local `prisma migrate dev`, which builds a throwaway
    // database to diff against. Hosted Postgres providers usually let Prisma
    // create one automatically, so this stays unset in deployment.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
