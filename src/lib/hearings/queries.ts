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

export type Hearing = ReturnType<typeof decode>;

export async function listCaseHearings(caseId: string): Promise<Hearing[]> {
  await requireCaseAccess(caseId);

  const rows = await prisma.hearing.findMany({
    where: { caseId },
    select: hearingSelect,
    orderBy: [{ date: "desc" }],
  });

  return rows.map(decode);
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

  return rows.map(decode);
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

  return rows.map(decode);
}

export async function getHearing(hearingId: string): Promise<Hearing | null> {
  const row = await prisma.hearing.findUnique({
    where: { id: hearingId },
    select: hearingSelect,
  });

  if (!row) return null;

  // Authorise against the owning case rather than the hearing itself.
  await requireCaseAccess(row.caseId);
  return decode(row);
}
