import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

/**
 * Prisma 7 removed connection URLs from the schema — the client must be given
 * either a driver adapter or an Accelerate URL.
 *
 * Two connection styles are supported so the same code runs in both places:
 *
 *   postgres:// | postgresql://  → node-postgres driver adapter.
 *                                  This is the deployment target (Neon,
 *                                  Vercel Postgres, RDS...), using the pooled
 *                                  DB_PRISMA_URL.
 *   prisma+postgres://           → Prisma Postgres / Accelerate, including the
 *                                  local server started by `prisma dev`.
 *
 * Migrations never come through here; they use DB_URL_NON_POOLING via
 * prisma.config.ts.
 *
 * The instance is cached on globalThis so dev-server hot reloads do not
 * exhaust the connection pool.
 */
function createPrismaClient() {
  const url = env.databaseUrl;
  const log =
    process.env.NODE_ENV === "development"
      ? (["warn", "error"] as const)
      : (["error"] as const);
  if (url.startsWith("prisma+postgres://") || url.startsWith("prisma://")) {
    return new PrismaClient({ accelerateUrl: url, log: [...log] });
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
    log: [...log],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
