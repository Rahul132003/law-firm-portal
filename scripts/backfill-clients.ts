/**
 * Link cases created before the client register to Client records.
 *
 *   npm run clients:backfill              dry run
 *   npm run clients:backfill -- --apply   create clients and link cases
 *
 * Cases are grouped by normalised client name (the same rule the app uses), so
 * "M/s Metro Developments Pvt Ltd" and "Metro Developments Limited" become one
 * client. Existing Client rows are reused. Safe to re-run: only cases with no
 * client are touched.
 *
 * Review the dry-run groups first. Two different people who share a name will
 * be merged; fix those afterwards by renaming on the client page.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { normalisePartyName } from "../src/lib/conflicts/match";

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
  const apply = process.argv.includes("--apply");
  const prisma = connect();

  try {
    const unlinked = await prisma.case.findMany({
      where: { clientId: null },
      select: { id: true, clientName: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const groups = new Map<string, { displayName: string; caseIds: string[]; variants: Set<string> }>();
    for (const row of unlinked) {
      const key = normalisePartyName(row.clientName) || row.clientName.trim().toLowerCase();
      const group = groups.get(key) ?? { displayName: row.clientName.trim(), caseIds: [], variants: new Set() };
      group.caseIds.push(row.id);
      group.variants.add(row.clientName.trim());
      groups.set(key, group);
    }

    console.log(`${apply ? "APPLYING" : "DRY RUN"} — ${unlinked.length} unlinked case(s) in ${groups.size} client group(s).\n`);

    let created = 0;
    let reused = 0;

    for (const [normalizedName, group] of groups) {
      const existing = await prisma.client.findFirst({
        where: { normalizedName },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      });

      const variants = [...group.variants];
      console.log(
        `${existing ? "reuse " : "create"}  ${existing?.name ?? group.displayName}  ← ${group.caseIds.length} case(s)` +
          (variants.length > 1 ? `  [spellings: ${variants.join(" | ")}]` : ""),
      );

      if (existing) reused += 1;
      else created += 1;
      if (!apply) continue;

      await prisma.$transaction(async (tx) => {
        const clientId =
          existing?.id ??
          (await tx.client.create({ data: { name: group.displayName, normalizedName }, select: { id: true } })).id;
        await tx.case.updateMany({
          where: { id: { in: group.caseIds }, clientId: null },
          data: { clientId },
        });
      });
    }

    console.log(`\n${created} client(s) ${apply ? "created" : "to create"}, ${reused} existing reused.`);
    if (!apply && unlinked.length > 0) console.log("Re-run with --apply to link them.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
