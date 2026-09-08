/**
 * Set a staff account's password to a value you choose.
 *
 *   npm run user:password -- someone@example.com "their new password"
 *
 * Until the admin console lands (build step 6), this is how accounts are
 * provisioned and recovered. Unlike the seed, it never generates or rotates
 * anything you did not ask it to.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const BCRYPT_ROUNDS = 9;
const MIN_LENGTH = 6;

function connect() {
  const connectionString = process.env.DB_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error("DB_URL_NON_POOLING is not set. See .env.example.");
  }
  return connectionString.startsWith("prisma+postgres://") ||
    connectionString.startsWith("prisma://")
    ? new PrismaClient({ accelerateUrl: connectionString })
    : new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error(
      'Usage: npm run user:password -- <email> "<new password>"\n' +
        "Quote the password if it contains spaces or shell characters.",
    );
    process.exit(1);
  }

  if (password.length < MIN_LENGTH) {
    console.error(
      `Password must be at least ${MIN_LENGTH} characters (got ${password.length}).`,
    );
    process.exit(1);
  }

  const prisma = connect();

  try {
    const normalised = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalised },
      select: { id: true, name: true, role: true, isActive: true },
    });

    if (!existing) {
      const known = await prisma.user.findMany({
        select: { email: true },
        orderBy: { email: "asc" },
      });
      console.error(`No account with email ${normalised}.`);
      console.error(
        `Known accounts: ${known.map((u) => u.email).join(", ") || "(none)"}`,
      );
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: await hash(password, BCRYPT_ROUNDS) },
    });

    console.log(
      `Password updated for ${normalised} (${existing.name}, ${existing.role}).`,
    );

    if (!existing.isActive) {
      console.log(
        "Note: this account is DEACTIVATED and still cannot sign in. " +
          "Reactivate it before use.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
