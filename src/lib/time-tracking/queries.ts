import "server-only";
import type { TimeActivity } from "@/generated/prisma/enums";
import { canReadAllCases } from "@/lib/auth/roles";
import {
  getVisibleUserIds,
  requireCaseAccess,
  type SessionUser,
} from "@/lib/dal";
import { FIRM_TIME_ZONE } from "@/lib/firm";
import { prisma } from "@/lib/prisma";
import { addDays, dayInTimeZone } from "./rules";

/**
 * Read side of time tracking.
 *
 * Whose time you may see mirrors case visibility: everyone sees their own,
 * a senior advocate also sees their direct reports', partners see everyone's.
 * Time on a particular case is visible to anyone who can open that case.
 */

/** Today in the firm's time zone, as a UTC-midnight calendar day. */
export function firmToday(now: Date = new Date()): Date {
  return dayInTimeZone(now, FIRM_TIME_ZONE);
}

/** People whose timesheets `user` may view, for the person picker. */
export async function getTimesheetPeople(user: SessionUser) {
  const where = canReadAllCases(user.role)
    ? { isActive: true }
    : { id: { in: await getVisibleUserIds(user) } };

  return prisma.user.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function canViewTimesheetOf(user: SessionUser, personId: string): Promise<boolean> {
  if (personId === user.id || canReadAllCases(user.role)) return true;
  return (await getVisibleUserIds(user)).includes(personId);
}

const entrySelect = {
  id: true,
  userId: true,
  workDate: true,
  minutes: true,
  activity: true,
  description: true,
  caseId: true,
  case: { select: { id: true, caseNumber: true, title: true } },
} as const;

/** One person's entries for the week starting `monday`. Caller checks access. */
export async function listWeekEntries(personId: string, monday: Date) {
  return prisma.timeEntry.findMany({
    where: { userId: personId, workDate: { gte: monday, lt: addDays(monday, 7) } },
    select: entrySelect,
    orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
  });
}

export type WeekEntry = Awaited<ReturnType<typeof listWeekEntries>>[number];

/** Per-person, per-day minutes for everyone `user` may see, for one week. */
export async function getTeamWeek(user: SessionUser, monday: Date) {
  const people = await getTimesheetPeople(user);
  const grouped = await prisma.timeEntry.groupBy({
    by: ["userId", "workDate"],
    where: {
      userId: { in: people.map((p) => p.id) },
      workDate: { gte: monday, lt: addDays(monday, 7) },
    },
    _sum: { minutes: true },
  });

  return people.map((person) => {
    const byDay = new Map<string, number>();
    for (const row of grouped) {
      if (row.userId !== person.id) continue;
      byDay.set(row.workDate.toISOString().slice(0, 10), row._sum.minutes ?? 0);
    }
    return { ...person, byDay };
  });
}

/** Minutes already recorded by a person on a day, optionally excluding one entry. */
export async function minutesOnDay(userId: string, day: Date, excludeEntryId?: string) {
  const result = await prisma.timeEntry.aggregate({
    where: {
      userId,
      workDate: day,
      ...(excludeEntryId ? { NOT: { id: excludeEntryId } } : {}),
    },
    _sum: { minutes: true },
  });
  return result._sum.minutes ?? 0;
}

export async function getRunningTimer(userId: string) {
  return prisma.runningTimer.findUnique({
    where: { userId },
    select: {
      caseId: true,
      activity: true,
      description: true,
      startedAt: true,
      case: { select: { caseNumber: true, title: true } },
    },
  });
}

/** Totals and recent entries for a case. Enforces case access. */
export async function getCaseTime(caseId: string) {
  await requireCaseAccess(caseId);

  const [byPerson, byActivity, recent, total] = await Promise.all([
    prisma.timeEntry.groupBy({
      by: ["userId"],
      where: { caseId },
      _sum: { minutes: true },
    }),
    prisma.timeEntry.groupBy({
      by: ["activity"],
      where: { caseId },
      _sum: { minutes: true },
    }),
    prisma.timeEntry.findMany({
      where: { caseId },
      select: { ...entrySelect, user: { select: { name: true } } },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.timeEntry.aggregate({ where: { caseId }, _sum: { minutes: true } }),
  ]);

  const names = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: byPerson.map((row) => row.userId) } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name]),
  );

  return {
    totalMinutes: total._sum.minutes ?? 0,
    byPerson: byPerson
      .map((row) => ({ name: names.get(row.userId) ?? "Former staff", minutes: row._sum.minutes ?? 0 }))
      .sort((a, b) => b.minutes - a.minutes),
    byActivity: byActivity
      .map((row) => ({ activity: row.activity as TimeActivity, minutes: row._sum.minutes ?? 0 }))
      .sort((a, b) => b.minutes - a.minutes),
    recent,
  };
}
