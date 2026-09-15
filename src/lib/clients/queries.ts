import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { canReadAllCases } from "@/lib/auth/roles";
import { caseScopeFilter, type SessionUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Read side of the client register.
 *
 * A client is visible to someone if they can see at least one of the client's
 * matters. Partners see every client, including ones with no matters yet.
 * Knowing a name is on the firm's books is itself confidential, so this
 * follows case scope rather than being open to all staff.
 */

async function clientScope(user: SessionUser): Promise<Prisma.ClientWhereInput> {
  if (canReadAllCases(user.role)) return {};
  return { cases: { some: await caseScopeFilter(user) } };
}

export async function getClientSuggestions(user: SessionUser): Promise<string[]> {
  const rows = await prisma.client.findMany({
    where: await clientScope(user),
    select: { name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
  return [...new Set(rows.map((row) => row.name))];
}

export async function listClients(user: SessionUser, q?: string) {
  const scope = await caseScopeFilter(user);

  return prisma.client.findMany({
    where: {
      ...(await clientScope(user)),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      kind: true,
      email: true,
      phone: true,
      updatedAt: true,
      // Counts only the matters this viewer may see.
      _count: { select: { cases: { where: scope } } },
      cases: {
        where: { ...scope, status: { not: "CLOSED" } },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export type ClientListRow = Awaited<ReturnType<typeof listClients>>[number];

/** Null when the client does not exist or is outside the viewer's scope. */
export async function getClientDetail(user: SessionUser, clientId: string) {
  const scope = await caseScopeFilter(user);

  return prisma.client.findFirst({
    where: { id: clientId, ...(await clientScope(user)) },
    select: {
      id: true,
      name: true,
      kind: true,
      email: true,
      phone: true,
      address: true,
      createdAt: true,
      cases: {
        where: scope,
        select: {
          id: true,
          caseNumber: true,
          title: true,
          caseType: true,
          status: true,
          court: true,
          opposingParty: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}

/** Most recent conflict check on a case, for the overview page. */
export async function getLatestConflictCheck(caseId: string) {
  return prisma.conflictCheck.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
    select: {
      outcome: true,
      adverseMatches: true,
      relatedMatches: true,
      waiverReason: true,
      createdAt: true,
      performedBy: { select: { name: true } },
    },
  });
}
