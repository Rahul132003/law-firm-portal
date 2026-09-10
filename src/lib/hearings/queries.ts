import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { safeDecryptField } from "@/lib/crypto";
import {
  caseScopeFilter,
  requireCaseAccess,
  type SessionUser,
} from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Read side of the court diary.
 *
 * Hearings inherit case scoping: the diary shows only hearings on matters the
 * viewer can reach, so the calendar is never a way to discover other people's
 * caseloads.
 */

const hearingSelect = {
  id: true,
  date: true,
  court: true,
  purpose: true,
  notes: true,
  nextDate: true,
  caseId: true,
  case: {
    select: {
      id: true,
      caseNumber: true,
      title: true,
      clientName: true,
      status: true,
    },
  },
} satisfies Prisma.HearingSelect;

type HearingRow = Prisma.HearingGetPayload<{ select: typeof hearingSelect }>;

/** Hearing notes are stored encrypted; decrypt for rendering. */
function decode(row: HearingRow) {
  return { ...row, notes: row.notes ? safeDecryptField(row.notes) : "" };
}

export type Hearing = ReturnType<typeof decode> & {
  /** The date of the immediately-prior hearing on this same case, if any. */
  previousDate: Date | null;
};

/**
 * Attaches, to each row, the date of the case's most recent EARLIER
 * hearing. The diary shows a hearing's history at a glance without a
 * round trip to the case's own Hearings tab.
 *
 * One extra query rather than N+1: it is scoped to only the case ids
 * already present in `rows`, which were reached through an authorised
 * query, so no new access-control surface is introduced.
 */
async function withPreviousDates(rows: HearingRow[]): Promise<Hearing[]> {
  const decoded = rows.map(decode);
  if (decoded.length === 0) return [];

  const caseIds = [...new Set(decoded.map((row) => row.caseId))];

  const history = await prisma.hearing.findMany({
    where: { caseId: { in: caseIds } },
    select: { id: true, caseId: true, date: true },
    orderBy: { date: "asc" },
  });

  const byCase = new Map<string, Array<{ id: string; date: Date }>>();
  for (const row of history) {
    const list = byCase.get(row.caseId) ?? [];
    list.push({ id: row.id, date: row.date });
    byCase.set(row.caseId, list);
  }

  const previousById = new Map<string, Date | null>();
  for (const list of byCase.values()) {
    // `list` is sorted ascending, so walk back from the entry just before
    // each one until a strictly earlier date is found — guards against two
    // hearings sharing the exact same timestamp.
    for (let i = 0; i < list.length; i += 1) {
      let previous: Date | null = null;
      for (let j = i - 1; j >= 0; j -= 1) {
        if (list[j]!.date.getTime() < list[i]!.date.getTime()) {
          previous = list[j]!.date;
          break;
        }
      }
      previousById.set(list[i]!.id, previous);
    }
  }

  return decoded.map((row) => ({
    ...row,
    previousDate: previousById.get(row.id) ?? null,
  }));
}

export async function listCaseHearings(caseId: string): Promise<Hearing[]> {
  await requireCaseAccess(caseId);

  const rows = await prisma.hearing.findMany({
    where: { caseId },
    select: hearingSelect,
    orderBy: [{ date: "desc" }],
  });

  return withPreviousDates(rows);
}

/** Every hearing in a date window, across reachable cases. Powers the calendar. */
export async function listHearingsInRange(
  user: SessionUser,
  from: Date,
  to: Date,
): Promise<Hearing[]> {
  const scope = await caseScopeFilter(user);

  const rows = await prisma.hearing.findMany({
    where: { case: scope, date: { gte: from, lte: to } },
    select: hearingSelect,
    orderBy: [{ date: "asc" }],
  });

  return withPreviousDates(rows);
}

/** Next N upcoming hearings from now, for the diary sidebar and dashboard. */
export async function listUpcomingHearings(
  user: SessionUser,
  limit = 10,
): Promise<Hearing[]> {
  const scope = await caseScopeFilter(user);

  const rows = await prisma.hearing.findMany({
    where: { case: scope, date: { gte: new Date() } },
    select: hearingSelect,
    orderBy: [{ date: "asc" }],
    take: limit,
  });

  return withPreviousDates(rows);
}

export async function getHearing(hearingId: string): Promise<Hearing | null> {
  const row = await prisma.hearing.findUnique({
    where: { id: hearingId },
    select: hearingSelect,
  });

  if (!row) return null;

  // Authorise against the owning case rather than the hearing itself.
  await requireCaseAccess(row.caseId);
  const [withHistory] = await withPreviousDates([row]);
  return withHistory ?? null;
}

/**
 * Every hearing on one calendar day, across reachable cases. Powers the
 * same-date clash check offered when editing a hearing's next date — kept
 * minimal (no notes decryption, no history) since it is a quick read, not
 * a detail view.
 */
export async function listHearingsOnDate(
  user: SessionUser,
  date: Date,
): Promise<
  Array<{
    id: string;
    caseId: string;
    date: Date;
    court: string;
    case: { caseNumber: string; title: string };
  }>
> {
  const scope = await caseScopeFilter(user);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return prisma.hearing.findMany({
    where: { case: scope, date: { gte: start, lt: end } },
    select: {
      id: true,
      caseId: true,
      date: true,
      court: true,
      case: { select: { caseNumber: true, title: true } },
    },
    orderBy: [{ date: "asc" }],
  });
}
