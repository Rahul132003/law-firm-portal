import "server-only";

import { isAdmin } from "@/lib/auth/roles";
import { caseScopeFilter, type SessionUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Reporting queries.
 *
 * Reports are visible to partners and senior advocates. A senior advocate's
 * figures are scoped to their own and their team's matters — the same rule as
 * everywhere else — so "cases per advocate" for a senior shows their team,
 * not the firm. Partners see the firm.
 */

const MS_PER_DAY = 86_400_000;

/** Start of today, local time. Report windows are day-aligned. */
function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export type ReportScope = { user: SessionUser; now: Date };

/** Headline counts for the admin dashboard tiles. */
export async function getFirmSummary({ user, now }: ReportScope) {
  const scope = await caseScopeFilter(user);
  const today = startOfDay(now);
  const weekEnd = new Date(today.getTime() + 7 * MS_PER_DAY);

  const [
    totalCases,
    openCases,
    hearingsThisWeek,
    overdueTasks,
    activeStaff,
    documentCount,
  ] = await Promise.all([
    prisma.case.count({ where: scope }),
    prisma.case.count({ where: { ...scope, status: { not: "CLOSED" } } }),
    prisma.hearing.count({
      where: { case: scope, date: { gte: today, lt: weekEnd } },
    }),
    prisma.task.count({
      where: {
        status: { not: "DONE" },
        dueDate: { lt: now },
        ...(isAdmin(user.role) ? {} : { case: scope }),
      },
    }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.document.count({ where: { isLatest: true, case: scope } }),
  ]);

  return {
    totalCases,
    openCases,
    closedCases: totalCases - openCases,
    hearingsThisWeek,
    overdueTasks,
    activeStaff,
    documentCount,
  };
}

/** Cases per advocate — the brief's first named report. */
export async function getCasesPerAdvocate({ user }: ReportScope) {
  const scope = await caseScopeFilter(user);

  // Group the assignment join table, constrained to reachable cases.
  const grouped = await prisma.caseAssignment.groupBy({
    by: ["userId"],
    where: { case: scope },
    _count: { _all: true },
  });

  if (grouped.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((row) => row.userId) } },
    select: { id: true, name: true, role: true, isActive: true },
  });

  const byId = new Map(users.map((u) => [u.id, u]));

  // Open vs closed split per advocate, so the number means workload rather
  // than lifetime history.
  const openGrouped = await prisma.caseAssignment.groupBy({
    by: ["userId"],
    where: { case: { ...scope, status: { not: "CLOSED" } } },
    _count: { _all: true },
  });
  const openById = new Map(
    openGrouped.map((row) => [row.userId, row._count._all]),
  );

  return grouped
    .map((row) => {
      const person = byId.get(row.userId);
      return {
        userId: row.userId,
        name: person?.name ?? "Unknown",
        role: person?.role ?? "ASSOCIATE",
        isActive: person?.isActive ?? false,
        total: row._count._all,
        open: openById.get(row.userId) ?? 0,
      };
    })
    .sort((a, b) => b.open - a.open || b.total - a.total);
}

/** Case distribution by status, for the board-shaped chart. */
export async function getCasesByStatus({ user }: ReportScope) {
  const scope = await caseScopeFilter(user);

  const grouped = await prisma.case.groupBy({
    by: ["status"],
    where: scope,
    _count: { _all: true },
  });

  return grouped.map((row) => ({
    status: row.status,
    count: row._count._all,
  }));
}

export async function getCasesByType({ user }: ReportScope) {
  const scope = await caseScopeFilter(user);

  const grouped = await prisma.case.groupBy({
    by: ["caseType"],
    where: scope,
    _count: { _all: true },
  });

  return grouped.map((row) => ({
    caseType: row.caseType,
    count: row._count._all,
  }));
}

/** Hearings in the coming week — the brief's second named report. */
export async function getHearingsThisWeek({ user, now }: ReportScope) {
  const scope = await caseScopeFilter(user);
  const today = startOfDay(now);
  const weekEnd = new Date(today.getTime() + 7 * MS_PER_DAY);

  return prisma.hearing.findMany({
    where: { case: scope, date: { gte: today, lt: weekEnd } },
    select: {
      id: true,
      date: true,
      court: true,
      purpose: true,
      caseId: true,
      case: {
        select: {
          caseNumber: true,
          title: true,
          assignments: {
            select: { user: { select: { name: true } } },
            take: 3,
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });
}

/** Overdue tasks — the brief's third named report. */
export async function getOverdueTasks({ user, now }: ReportScope) {
  const scope = await caseScopeFilter(user);

  return prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      dueDate: { lt: now },
      ...(isAdmin(user.role) ? {} : { case: scope }),
    },
    select: {
      id: true,
      description: true,
      dueDate: true,
      kind: true,
      status: true,
      caseId: true,
      assignedTo: { select: { name: true } },
      case: { select: { caseNumber: true, title: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 200,
  });
}

/** New cases per month over the last year, for the trend chart. */
export async function getCaseIntakeTrend({ user, now }: ReportScope) {
  const scope = await caseScopeFilter(user);
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const cases = await prisma.case.findMany({
    where: { ...scope, createdAt: { gte: start } },
    select: { createdAt: true },
  });

  // Bucket in JS: twelve rows is not worth a raw SQL date_trunc, and this
  // keeps the query portable.
  const buckets = new Map<string, number>();
  for (let i = 0; i < 12; i += 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    buckets.set(
      `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
      0,
    );
  }

  for (const record of cases) {
    const key = `${record.createdAt.getFullYear()}-${String(record.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([month, count]) => ({
    month,
    label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(
      new Date(`${month}-01T00:00:00`),
    ),
    count,
  }));
}
