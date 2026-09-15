/**
 * Re-seal every encrypted field under the current FIELD_ENCRYPTION_KEY.
 *
 *   npm run crypto:rotate              dry run: report what would change
 *   npm run crypto:rotate -- --apply   rewrite rows
 *
 * Rotation procedure:
 *   1. Generate a new key:  openssl rand -base64 32
 *   2. Deploy with FIELD_ENCRYPTION_KEY=<new> and
 *      FIELD_ENCRYPTION_KEY_PREVIOUS=<old>. The app now writes with the new
 *      key and still reads the old one.
 *   3. Run this script with the same two variables, first as a dry run, then
 *      with --apply.
 *   4. When a dry run reports 0 rows to rotate and 0 unreadable, remove
 *      FIELD_ENCRYPTION_KEY_PREVIOUS and redeploy. Keep the old key in your
 *      secrets manager until you are sure backups no longer need it.
 *
 * Safe to re-run and safe alongside live traffic: rows already under the
 * current key are skipped, and each update only applies if the stored value
 * is unchanged since it was read. Rows no configured key can open are
 * reported and left exactly as they are.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  isSealedWith,
  parseKey,
  parseKeyList,
  seal,
  unseal,
} from "../src/lib/field-cipher";

const BATCH_SIZE = 200;

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

type Tally = {
  scanned: number;
  current: number;
  rotated: number;
  unreadable: string[];
  changedConcurrently: number;
};

async function main() {
  const apply = process.argv.includes("--apply");

  const current = parseKey(process.env.FIELD_ENCRYPTION_KEY ?? "");
  const keys = [current, ...parseKeyList(process.env.FIELD_ENCRYPTION_KEY_PREVIOUS)];

  console.log(
    `${apply ? "APPLYING" : "DRY RUN"} — current key ${current.id}, ` +
      `${keys.length - 1} previous key(s) configured.`,
  );

  const prisma = connect();

  /**
   * Walks one table by id and re-seals a single column. `update` must write
   * only when the column still holds `from`, and report how many rows it hit.
   */
  async function rotateColumn(
    label: string,
    fetch: (cursor: string | undefined) => Promise<Array<{ id: string; value: string | null }>>,
    update: (id: string, from: string, to: string) => Promise<number>,
  ): Promise<Tally> {
    const tally: Tally = { scanned: 0, current: 0, rotated: 0, unreadable: [], changedConcurrently: 0 };
    let cursor: string | undefined;

    for (;;) {
      const rows = await fetch(cursor);
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1]!.id;

      for (const row of rows) {
        if (!row.value) continue;
        tally.scanned += 1;

        if (isSealedWith(row.value, current)) {
          tally.current += 1;
          continue;
        }

        let plaintext: string;
        try {
          plaintext = unseal(row.value, keys);
        } catch {
          tally.unreadable.push(row.id);
          continue;
        }

        if (!apply) {
          tally.rotated += 1;
          continue;
        }

        const hit = await update(row.id, row.value, seal(plaintext, current));
        if (hit === 1) tally.rotated += 1;
        else tally.changedConcurrently += 1;
      }
    }

    console.log(
      `${label}: ${tally.scanned} encrypted, ${tally.current} already current, ` +
        `${tally.rotated} ${apply ? "rotated" : "to rotate"}, ` +
        `${tally.unreadable.length} unreadable` +
        (tally.changedConcurrently ? `, ${tally.changedConcurrently} skipped (edited during run — re-run)` : ""),
    );
    if (tally.unreadable.length) {
      console.log(`  unreadable ids: ${tally.unreadable.slice(0, 20).join(", ")}${tally.unreadable.length > 20 ? " …" : ""}`);
    }
    return tally;
  }

  try {
    const page = (cursor: string | undefined) => ({
      take: BATCH_SIZE,
      orderBy: { id: "asc" as const },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const notes = await rotateColumn(
      "Case notes",
      async (cursor) =>
        (await prisma.caseNote.findMany({ ...page(cursor), select: { id: true, body: true } })).map(
          (row) => ({ id: row.id, value: row.body }),
        ),
      async (id, from, to) =>
        (await prisma.caseNote.updateMany({ where: { id, body: from }, data: { body: to } })).count,
    );

    const hearings = await rotateColumn(
      "Hearing notes",
      async (cursor) =>
        (await prisma.hearing.findMany({ ...page(cursor), select: { id: true, notes: true } })).map(
          (row) => ({ id: row.id, value: row.notes }),
        ),
      async (id, from, to) =>
        (await prisma.hearing.updateMany({ where: { id, notes: from }, data: { notes: to } })).count,
    );

    const unreadable = notes.unreadable.length + hearings.unreadable.length;
    const pending = apply
      ? notes.changedConcurrently + hearings.changedConcurrently
      : notes.rotated + hearings.rotated;

    if (unreadable > 0) {
      console.log(
        "\nSome rows could not be decrypted with any configured key. Do NOT remove " +
          "FIELD_ENCRYPTION_KEY_PREVIOUS until you have found the key that sealed them.",
      );
      process.exitCode = 2;
    } else if (pending === 0) {
      console.log("\nEverything is sealed under the current key. Previous keys can be retired.");
    } else if (!apply) {
      console.log("\nRe-run with --apply to rotate.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
