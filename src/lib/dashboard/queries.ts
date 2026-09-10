import "server-only";

import type { TaskStatus } from "@/generated/prisma/enums";
import { canViewReports, isAdmin } from "@/lib/auth/roles";
import {
  caseScopeFilter,
  getVisibleUserIds,
  type SessionUser,
} from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Dashboard data.
 *
 * Every figure is scoped through `caseScopeFilter`, so the same component
 * renders honestly for a partner and for a paralegal — the numbers differ
 * because the visibility differs, not because the page branches on role.
 *
 * The oversight block is the one genuinely role-gated part: it is only
 * fetched for people who can act on firm-wide numbers.
 */

const MS_PER_DAY = 86_400_000;

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export async function getDashboardData(user: SessionUser, now: Date) {
  const scope = await caseScopeFilter(user);
  const today = startOfDay(now);
  const tomorrowEnd = new Date(today.getTime() + 2 * MS_PER_DAY);
  const weekEnd = new Date(today.getTime() + 7 * MS_PER_DAY);

  const [
    myOpenTasks,
    myOverdue,
    myDueThisWeek,
    unreadNotices,
    myCases,
    hearingsSoon,
    upcomingHearings,
    recentDocuments,
    myTasks,
    casesByStatusRaw,
    myTasksByStatusRaw,
  ] = await Promise.all([
    prisma.task.count({
      where: { assignedToId: user.id, status: { not: "DONE" } },
    }),
    prisma.task.count({
      where: {
        assignedToId: user.id,
        status: { not: "DONE" },
        dueDate: { lt: now },
      },
    }),
    prisma.task.count({
      where: {
        assignedToId: user.id,
        status: { not: "DONE" },
        dueDate: { gte: now, lte: weekEnd },
      },
    }),
    prisma.notice.count({ where: { reads: { none: { userId: user.id } } } }),
    prisma.case.count({ where: { ...scope, status: { not: "CLOSED" } } }),
    // Today and tomorrow — the "walking into court" window.
    prisma.hearing.count({
      where: { case: scope, date: { gte: today, lt: tomorrowEnd } },
    }),
    prisma.hearing.findMany({
      where: { case: scope, date: { gte: now } },
      select: {
        id: true,
        date: true,
        court: true,
        purpose: true,
        caseId: true,
        case: { select: { caseNumber: true, title: true } },
      },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.document.findMany({
      where: { isLatest: true, case: scope },
      select: {
        id: true,
        title: true,
        category: true,
        uploadedAt: true,
        caseId: true,
        uploadedBy: { select: { name: true } },
        case: { select: { caseNumber: true } },
      },
      orderBy: { uploadedAt: "desc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: { assignedToId: user.id, status: { not: "DONE" } },
      select: {
        id: true,
        description: true,
        dueDate: true,
        status: true,
        kind: true,
        caseId: true,
        case: { select: { caseNumber: true } },
      },
      orderBy: [{ dueDate: "asc" }],
      take: 6,
    }),
    prisma.case.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    }),
    // Deliberately unfiltered by status: the dashboard's work card reports
    // done alongside outstanding, and `myOpenTasks` above already excludes
    // DONE, so counting it here would need a second round trip.
    prisma.task.groupBy({
      by: ["status"],
      where: { assignedToId: user.id },
      _count: { _all: true },
    }),
  ]);

  const STATUS_LABELS: Record<string, string> = {
    FILED: "Filed",
    UNDER_TRIAL: "Under Trial",
    JUDGMENT: "Judgment",
    APPEAL: "Appeal",
    CLOSED: "Closed",
  };

  const casesByStatus = casesByStatusRaw.map((row) => ({
    label: STATUS_LABELS[row.status] ?? row.status,
    count: row._count._all,
  }));

  // Ensure consistent ordering
  casesByStatus.sort(
    (a, b) =>
      Object.values(STATUS_LABELS).indexOf(a.label) -
      Object.values(STATUS_LABELS).indexOf(b.label),
  );

  // Seeded with every status so the card renders a real zero rather than a
  // gap for a status nobody currently has.
  const myTasksByStatus: Record<TaskStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    BLOCKED: 0,
    DONE: 0,
  };
  for (const row of myTasksByStatusRaw) {
    myTasksByStatus[row.status] = row._count._all;
  }

  return {
    myOpenTasks,
    myOverdue,
    myDueThisWeek,
    unreadNotices,
    myCases,
    hearingsSoon,
    upcomingHearings,
    recentDocuments,
    myTasks,
    casesByStatus,
    myTasksByStatus,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

/**
 * Oversight figures for partners and senior advocates: what is happening
 * across everything they are responsible for, not just their own desk.
 */
export async function getOversightData(user: SessionUser, now: Date) {
  if (!canViewReports(user.role)) return null;

  const scope = await caseScopeFilter(user);
  const today = startOfDay(now);
  const weekEnd = new Date(today.getTime() + 7 * MS_PER_DAY);
  const teamIds = await getVisibleUserIds(user);

  const [openCases, hearingsThisWeek, overdueAcrossScope, unassignedCases] =
    await Promise.all([
      prisma.case.count({ where: { ...scope, status: { not: "CLOSED" } } }),
      prisma.hearing.count({
        where: { case: scope, date: { gte: today, lt: weekEnd } },
      }),
      prisma.task.count({
        where: {
          status: { not: "DONE" },
          dueDate: { lt: now },
          ...(isAdmin(user.role) ? {} : { assignedToId: { in: teamIds } }),
        },
      }),
      // A case with nobody on it is invisible to every non-admin, so it is
      // worth surfacing to the people who can fix it.
      prisma.case.count({
        where: {
          ...scope,
          status: { not: "CLOSED" },
          assignments: { none: {} },
        },
      }),
    ]);

  return {
    openCases,
    hearingsThisWeek,
    overdueAcrossScope,
    unassignedCases,
    isFirmWide: isAdmin(user.role),
  };
}
