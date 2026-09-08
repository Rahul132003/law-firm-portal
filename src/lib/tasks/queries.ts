import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { TaskStatus } from "@/generated/prisma/enums";
import { isAdmin } from "@/lib/auth/roles";
import {
  caseScopeFilter,
  requireCaseAccess,
  requireUser,
  type SessionUser,
} from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Read side of task management.
 *
 * Scoping rule: a task is visible if it is assigned to you, or it hangs off a
 * case you can reach. Partners see everything, including personal tasks with
 * no case attached — this is an internal tool and partners own oversight of
 * firm workload (build step 6 reports depend on it).
 */

const taskSelect = {
  id: true,
  description: true,
  dueDate: true,
  status: true,
  kind: true,
  completedAt: true,
  createdAt: true,
  caseId: true,
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  case: { select: { id: true, caseNumber: true, title: true } },
} satisfies Prisma.TaskSelect;

export type TaskSummary = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

export async function taskScopeFilter(
  user: SessionUser,
): Promise<Prisma.TaskWhereInput> {
  if (isAdmin(user.role)) return {};

  const scope = await caseScopeFilter(user);

  return {
    OR: [
      { assignedToId: user.id },
      // `case: scope` matches only case-linked tasks; someone else's personal
      // task therefore stays private, which is the intent.
      { case: scope },
    ],
  };
}

export type TaskFilters = {
  status?: TaskStatus;
  assigneeId?: string;
  /** Only deadlines (filing / limitation), not general work items. */
  deadlinesOnly?: boolean;
  overdueOnly?: boolean;
};

function buildWhere(
  scope: Prisma.TaskWhereInput,
  filters: TaskFilters,
  now: Date,
): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [scope];

  if (filters.status) and.push({ status: filters.status });
  if (filters.assigneeId) and.push({ assignedToId: filters.assigneeId });
  if (filters.deadlinesOnly) {
    and.push({ kind: { in: ["FILING_DEADLINE", "LIMITATION_DEADLINE"] } });
  }
  if (filters.overdueOnly) {
    and.push({ dueDate: { lt: now }, status: { not: "DONE" } });
  }

  return { AND: and };
}

/** Everything the user can see, for the firm-wide task view. */
export async function listTasks(
  user: SessionUser,
  filters: TaskFilters,
  now: Date,
): Promise<TaskSummary[]> {
  const scope = await taskScopeFilter(user);

  return prisma.task.findMany({
    where: buildWhere(scope, filters, now),
    select: taskSelect,
    // Open work first, then soonest due.
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 300,
  });
}

/** The personal dashboard: only what is assigned to me. */
export async function listMyTasks(
  user: SessionUser,
  filters: TaskFilters,
  now: Date,
): Promise<TaskSummary[]> {
  return prisma.task.findMany({
    where: buildWhere({ assignedToId: user.id }, filters, now),
    select: taskSelect,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}

export async function listCaseTasks(caseId: string): Promise<TaskSummary[]> {
  await requireCaseAccess(caseId);

  return prisma.task.findMany({
    where: { caseId },
    select: taskSelect,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}

/** Counts for the dashboard tiles. One query, grouped, rather than four. */
export async function getMyTaskCounts(user: SessionUser, now: Date) {
  const [byStatus, overdue, dueSoon] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: { assignedToId: user.id },
      _count: { _all: true },
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
        dueDate: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 86_400_000),
        },
      },
    }),
  ]);

  const counts: Record<TaskStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    BLOCKED: 0,
    DONE: 0,
  };
  for (const row of byStatus) counts[row.status] = row._count._all;

  return { byStatus: counts, overdue, dueSoon };
}

/** Fetches a task only if the caller may see it. */
export async function getTaskForAccess(
  taskId: string,
): Promise<TaskSummary | null> {
  const user = await requireUser();
  const scope = await taskScopeFilter(user);

  return prisma.task.findFirst({
    where: { AND: [{ id: taskId }, scope] },
    select: taskSelect,
  });
}

/** Staff who can be given tasks. */
export async function getAssignableStaff() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: [{ name: "asc" }],
  });
}

/** Cases the user can attach a task to. */
export async function getAssignableCases(user: SessionUser) {
  const scope = await caseScopeFilter(user);

  return prisma.case.findMany({
    where: scope,
    select: { id: true, caseNumber: true, title: true },
    orderBy: [{ caseNumber: "asc" }],
    take: 300,
  });
}
