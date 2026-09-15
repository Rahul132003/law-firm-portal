import "server-only";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import type { CaseStatus, CaseType } from "@/generated/prisma/enums";
import { canViewStrategyNotes } from "@/lib/auth/roles";
import { safeDecryptField } from "@/lib/crypto";
import {
  caseScopeFilter,
  requireCaseAccess,
  requireUser,
  type SessionUser,
} from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Read side of case management.
 *
 * Every function here begins from `caseScopeFilter(user)`, so an Associate
 * physically cannot retrieve a case they are not assigned to — the constraint
 * is in the SQL, not in a post-filter that could be forgotten.
 */

export type CaseFilters = {
  status?: CaseStatus;
  caseType?: CaseType;
  court?: string;
  advocateId?: string;
  q?: string;
};

/** Shared row shape for the list and the board. */
const caseSummarySelect = {
  id: true,
  caseNumber: true,
  title: true,
  clientName: true,
  caseType: true,
  court: true,
  jurisdiction: true,
  status: true,
  boardPosition: true,
  filedOn: true,
  updatedAt: true,
  assignments: {
    select: {
      roleOnCase: true,
      user: { select: { id: true, name: true, role: true } },
    },
    orderBy: { assignedAt: "asc" },
  },
  _count: { select: { documents: true, hearings: true, tasks: true } },
} satisfies Prisma.CaseSelect;

export type CaseSummary = Prisma.CaseGetPayload<{
  select: typeof caseSummarySelect;
}>;

function buildWhere(
  scope: Prisma.CaseWhereInput,
  filters: CaseFilters,
): Prisma.CaseWhereInput {
  const where: Prisma.CaseWhereInput = { ...scope };
  const and: Prisma.CaseWhereInput[] = [];

  if (filters.status) where.status = filters.status;
  if (filters.caseType) where.caseType = filters.caseType;
  if (filters.court) where.court = filters.court;

  if (filters.advocateId) {
    // Intersects with the scope filter rather than replacing it: filtering by
    // a colleague must never widen what you can see.
    and.push({ assignments: { some: { userId: filters.advocateId } } });
  }

  if (filters.q) {
    const q = filters.q;
    and.push({
      OR: [
        { caseNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { clientName: { contains: q, mode: "insensitive" } },
        { opposingParty: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

export async function listCases(
  user: SessionUser,
  filters: CaseFilters,
): Promise<CaseSummary[]> {
  const scope = await caseScopeFilter(user);

  return prisma.case.findMany({
    where: buildWhere(scope, filters),
    select: caseSummarySelect,
    orderBy: [{ updatedAt: "desc" }],
  });
}

/** Same rows as the list, grouped into Kanban columns. */
export async function listCasesByStatus(
  user: SessionUser,
  filters: CaseFilters,
): Promise<Record<CaseStatus, CaseSummary[]>> {
  const scope = await caseScopeFilter(user);

  const rows = await prisma.case.findMany({
    // Status is the board's axis, so an active status filter is ignored here.
    where: buildWhere(scope, { ...filters, status: undefined }),
    select: caseSummarySelect,
    orderBy: [{ boardPosition: "asc" }, { updatedAt: "desc" }],
  });

  const grouped: Record<CaseStatus, CaseSummary[]> = {
    FILED: [],
    UNDER_TRIAL: [],
    JUDGMENT: [],
    APPEAL: [],
    CLOSED: [],
  };

  for (const row of rows) grouped[row.status].push(row);
  return grouped;
}

/**
 * Distinct courts the user can actually see, for the filter dropdown.
 * Deriving these from scoped rows avoids leaking the existence of courts
 * that only appear on other people's matters.
 */
export async function getCourtOptions(user: SessionUser): Promise<string[]> {
  const scope = await caseScopeFilter(user);
  const rows = await prisma.case.findMany({
    where: scope,
    select: { court: true },
    distinct: ["court"],
    orderBy: { court: "asc" },
  });
  return rows.map((row) => row.court);
}

/** Staff who can be assigned to cases, and who populate the advocate filter. */
export const getAssignableStaff = cache(async () => {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
});

export type CaseDetail = NonNullable<Awaited<ReturnType<typeof getCaseDetail>>>;

/** Full record for the case detail page. Throws 403 if out of scope. */
export async function getCaseDetail(caseId: string) {
  const { user } = await requireCaseAccess(caseId);

  const record = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      ...caseSummarySelect,
      judge: true,
      opposingParty: true,
      opposingCounsel: true,
      clientId: true,
      createdAt: true,
    },
  });

  if (!record) return null;
  return { ...record, viewer: user };
}

/**
 * Notes for a case, with the paralegal carve-out applied in the query and
 * bodies decrypted for rendering.
 */
export async function getCaseNotes(caseId: string) {
  const { user } = await requireCaseAccess(caseId);

  const rows = await prisma.caseNote.findMany({
    where: {
      caseId,
      // Paralegals never receive strategy notes — enforced in SQL so the
      // ciphertext does not even leave the database for them.
      ...(canViewStrategyNotes(user.role) ? {} : { visibility: "CASE_TEAM" }),
    },
    select: {
      id: true,
      body: true,
      visibility: true,
      createdAt: true,
      author: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    ...row,
    body: safeDecryptField(row.body),
  }));
}

/** Counts shown on the detail tabs. */
export async function getCaseTabCounts(caseId: string) {
  const user = await requireUser();

  const [documents, hearings, tasks, notes] = await Promise.all([
    prisma.document.count({ where: { caseId, isLatest: true } }),
    prisma.hearing.count({ where: { caseId } }),
    prisma.task.count({ where: { caseId, status: { not: "DONE" } } }),
    prisma.caseNote.count({
      where: {
        caseId,
        ...(canViewStrategyNotes(user.role) ? {} : { visibility: "CASE_TEAM" }),
      },
    }),
  ]);

  return { documents, hearings, tasks, notes };
}

/** Used by the edit form to prefill assignments. */
export async function getCaseForEdit(caseId: string) {
  await requireCaseAccess(caseId);

  return prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      caseNumber: true,
      title: true,
      clientName: true,
      caseType: true,
      court: true,
      jurisdiction: true,
      judge: true,
      opposingParty: true,
      opposingCounsel: true,
      status: true,
      filedOn: true,
      assignments: {
        select: { userId: true, roleOnCase: true },
      },
    },
  });
}
