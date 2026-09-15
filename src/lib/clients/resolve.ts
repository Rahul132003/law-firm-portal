import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { normalisePartyName } from "@/lib/conflicts/match";

/**
 * Finds the client record a typed name refers to, creating one if none
 * exists. Runs inside the caller's transaction so a failed case save does not
 * leave an orphan client behind.
 *
 * Resolution is by normalised name, oldest record first. Two genuinely
 * different clients with an identical name will share a record; the client
 * page is where that gets noticed and corrected.
 */
export async function resolveClientId(
  tx: Prisma.TransactionClient,
  name: string,
): Promise<string> {
  const normalizedName = normalisePartyName(name) || name.trim().toLowerCase();

  const existing = await tx.client.findFirst({
    where: { normalizedName },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.client.create({
    data: { name: name.trim(), normalizedName },
    select: { id: true },
  });
  return created.id;
}
