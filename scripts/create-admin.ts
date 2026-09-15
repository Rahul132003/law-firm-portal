/**
 * Provision (or reset) the single administrator account.
 *
 * Reads three variables from the environment — set them in `.env` or inline:
 *
 *   ADMIN_EMAIL      login email
 *   ADMIN_PASSWORD   plaintext password (>= 12 chars); stored bcrypt-hashed
 *   ADMIN_NAME       display name (optional, defaults to "Administrator")
 *
 * Idempotent: run it once after `prisma migrate deploy` against a fresh
 * database, or again any time to force the password/role back to a known
 * state. It never touches other accounts.
 *
 *   npx tsx scripts/create-admin.ts
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { compare, hash } from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 12;

function connect() {
  const url =
    process.env.DB_URL_NON_POOLING ?? process.env.DB_PRISMA_URL ?? "";
  if (!url) {
    throw new Error(
      "Set DB_URL_NON_POOLING (or DB_PRISMA_URL) to your database connection string.",
    );
  }
  return url.startsWith("prisma+postgres://") || url.startsWith("prisma://")
    ? new PrismaClient({ accelerateUrl: url })
    : new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = (process.env.ADMIN_NAME ?? "Administrator").trim();

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must both be set.");
  }
  if (password.length < MIN_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_LENGTH} characters (got ${password.length}).`,
    );
  }

  const prisma = connect();
  try {
    const passwordHash = await hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash, role: "ADMIN_PARTNER", isActive: true },
      update: { passwordHash, role: "ADMIN_PARTNER", isActive: true },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    const check = await prisma.user.findUnique({
      where: { email },
      select: { passwordHash: true },
    });

    console.log("admin ready:", JSON.stringify(user));
    console.log("password verifies:", await compare(password, check!.passwordHash));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
