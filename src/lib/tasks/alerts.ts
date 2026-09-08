import "server-only";
import type { ReminderOffset, TaskKind } from "@/generated/prisma/enums";
import { deliver } from "@/lib/notifications/deliver";
import { prisma } from "@/lib/prisma";

/**
 * Deadline alert sweep.
 *
 * Same bucketing contract as the hearing sweep: an alert fires for the most
 * urgent window a deadline has *entered*, less urgent windows are recorded as
 * handled so they cannot fire late, and `TaskAlert` is unique on
 * (task, offset) so re-running sends nothing twice.
 *
 * Statutory limitation deadlines get the longest lead time, because missing
 * one is not recoverable — a 30-day warning is the point.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Most urgent first. */
const UPCOMING_BUCKETS: ReadonlyArray<{
  offset: ReminderOffset;
  days: number;
}> = [
  { offset: "DAY_1", days: 1 },
  { offset: "DAY_3", days: 3 },
  { offset: "DAY_7", days: 7 },
  { offset: "DAY_14", days: 14 },
  { offset: "DAY_30", days: 30 },
];

/** Filing deadlines get a shorter runway than limitation periods. */
const LEAD_DAYS: Record<TaskKind, number> = {
  GENERAL: 3,
  FILING_DEADLINE: 14,
  LIMITATION_DEADLINE: 30,
};

export type DeadlineSweepResult = {
  tasksExamined: number;
  alertsSent: number;
  overdueAlerts: number;
  recipientsNotified: number;
  deliveryFailures: number;
  suppressed: number;
};

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / MS_PER_DAY);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

export async function runTaskDeadlineSweep(
  now: Date = new Date(),
): Promise<DeadlineSweepResult> {
  const horizon = new Date(now.getTime() + 30 * MS_PER_DAY);

  const tasks = await prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      // Everything from already-overdue up to the longest lead time.
      dueDate: { lte: horizon },
    },
    select: {
      id: true,
      description: true,
      dueDate: true,
      kind: true,
      caseId: true,
      assignedTo: { select: { id: true } },
      case: { select: { caseNumber: true, title: true } },
      alerts: { select: { offset: true } },
    },
  });

  const result: DeadlineSweepResult = {
    tasksExamined: tasks.length,
    alertsSent: 0,
    overdueAlerts: 0,
    recipientsNotified: 0,
    deliveryFailures: 0,
    suppressed: 0,
  };

  for (const task of tasks) {
    const remaining = daysUntil(task.dueDate, now);
    const alreadySent = new Set(task.alerts.map((a) => a.offset));
    const lead = LEAD_DAYS[task.kind];

    let current: ReminderOffset;
    let stale: ReminderOffset[] = [];
    let headline: string;

    if (remaining < 0) {
      // Past due: one escalation, regardless of which windows were missed.
      current = "OVERDUE";
      stale = UPCOMING_BUCKETS.filter(
        (bucket) => !alreadySent.has(bucket.offset) && bucket.days <= lead,
      ).map((bucket) => bucket.offset);
      headline = task.kind === "GENERAL" ? "Overdue task" : "Overdue deadline";
    } else {
      // Only buckets within this kind's lead time are eligible.
      const eligible = UPCOMING_BUCKETS.filter((bucket) => bucket.days <= lead);
      const bucket = eligible.find((entry) => remaining <= entry.days);
      if (!bucket) continue;

      current = bucket.offset;
      stale = eligible
        .filter(
          (entry) => entry.days > bucket.days && !alreadySent.has(entry.offset),
        )
        .map((entry) => entry.offset);
      headline =
        bucket.days === 1 ? "Due tomorrow" : `Due in ${bucket.days} days`;
    }

    if (alreadySent.has(current)) continue;

    try {
      await prisma.taskAlert.createMany({
        data: [current, ...stale].map((offset) => ({
          taskId: task.id,
          offset,
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      console.error(`Could not record alert for task ${task.id}`, error);
      continue;
    }

    result.suppressed += stale.length;
    if (current === "OVERDUE") result.overdueAlerts += 1;

    const context = task.case
      ? `${task.case.caseNumber} — ${task.case.title}`
      : "Personal task";

    const delivered = await deliver({
      userId: task.assignedTo.id,
      kind: "TASK_DUE",
      title: `${headline}: ${task.description.slice(0, 60)}`,
      body: `${context}. Due ${formatDate(task.dueDate)}.`,
      linkUrl: task.caseId ? `/cases/${task.caseId}/tasks` : "/tasks",
    });

    if (delivered) result.recipientsNotified += 1;
    else result.deliveryFailures += 1;

    result.alertsSent += 1;
  }

  return result;
}
