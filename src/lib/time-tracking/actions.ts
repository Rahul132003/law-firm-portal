"use server";
import { revalidatePath } from "next/cache";

import type { TimeActivity } from "@/generated/prisma/enums";
import { isAdmin } from "@/lib/auth/roles";
import { fieldErrors } from "@/lib/cases/validation";
import { hasCaseAccess, requireUser, type SessionUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

import { firmToday, minutesOnDay } from "./queries";
import {
  MAX_TIMER_MINUTES,
  TIME_ACTIVITY_ORDER,
  checkEntryLimits,
  dayInTimeZone,
  elapsedMinutes,
  formatMinutes,
  timeEntrySchema,
  type TimeEntryInput,
} from "./rules";
import { FIRM_TIME_ZONE } from "@/lib/firm";

/**
 * Write side of time tracking. Every entry belongs to the person who recorded
 * it: only they can edit it. A partner may delete any entry (for corrections),
 * but never rewrites someone else's hours.
 */

export type TimeFormState = {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readEntryForm(formData: FormData) {
  return {
    caseId: text(formData, "caseId"),
    workDate: text(formData, "workDate"),
    duration: text(formData, "duration"),
    activity: text(formData, "activity"),
    description: text(formData, "description"),
  };
}

function revalidateTime(caseIds: Array<string | null | undefined>) {
  revalidatePath("/time");
  for (const caseId of new Set(caseIds)) {
    if (caseId) revalidatePath(`/cases/${caseId}/time`);
  }
}

async function validateEntry(
  user: SessionUser,
  formData: FormData,
  excludeEntryId?: string,
): Promise<{ ok: true; data: TimeEntryInput } | { ok: false; errors: Record<string, string> }> {
  const parsed = timeEntrySchema.safeParse(readEntryForm(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const data = parsed.data;
  if (data.caseId && !(await hasCaseAccess(user, data.caseId))) {
    return { ok: false, errors: { caseId: "That case is not available to you." } };
  }

  const limitErrors = checkEntryLimits({
    workDate: data.workDate,
    minutes: data.minutes,
    otherMinutesThatDay: await minutesOnDay(user.id, data.workDate, excludeEntryId),
    latestAllowedDay: firmToday(),
  });
  if (limitErrors) return { ok: false, errors: limitErrors };

  return { ok: true, data };
}

export async function createTimeEntry(
  _prev: TimeFormState,
  formData: FormData,
): Promise<TimeFormState> {
  const user = await requireUser();
  const result = await validateEntry(user, formData);
  if (!result.ok) return { errors: result.errors };

  await prisma.timeEntry.create({ data: { ...result.data, userId: user.id } });

  revalidateTime([result.data.caseId]);
  return { ok: true, message: `Recorded ${formatMinutes(result.data.minutes)}.` };
}

export async function updateTimeEntry(
  entryId: string,
  _prev: TimeFormState,
  formData: FormData,
): Promise<TimeFormState> {
  const user = await requireUser();

  const existing = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId: user.id },
    select: { caseId: true },
  });
  if (!existing) return { message: "You can only edit your own time entries." };

  const result = await validateEntry(user, formData, entryId);
  if (!result.ok) return { errors: result.errors };

  await prisma.timeEntry.update({ where: { id: entryId }, data: result.data });

  revalidateTime([existing.caseId, result.data.caseId]);
  return { ok: true, message: "Saved." };
}

export async function deleteTimeEntry(entryId: string): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();

  const existing = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, caseId: true },
  });
  if (!existing) return { ok: true };

  if (existing.userId !== user.id && !isAdmin(user.role)) {
    return { ok: false, message: "You can only delete your own time entries." };
  }

  await prisma.timeEntry.delete({ where: { id: entryId } });
  revalidateTime([existing.caseId]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

export type TimerResult = { ok: boolean; message?: string };

/**
 * Turns the caller's running timer into an entry and clears it. Returns a
 * message describing what happened. Shared by stop and by starting a new timer
 * while one is running.
 */
async function finishTimer(user: SessionUser): Promise<TimerResult> {
  const timer = await prisma.runningTimer.findUnique({ where: { userId: user.id } });
  if (!timer) return { ok: true, message: "No timer was running." };

  const now = new Date();
  const minutes = elapsedMinutes(timer.startedAt, now);

  // Delete first, conditionally on the exact timer read, so a double click or
  // a second tab cannot record the same stretch of time twice.
  const { count } = await prisma.runningTimer.deleteMany({
    where: { userId: user.id, startedAt: timer.startedAt },
  });
  if (count === 0) return { ok: true, message: "That timer was already stopped." };

  if (minutes < 1) {
    return { ok: true, message: "Timer stopped after less than a minute; nothing recorded." };
  }
  if (minutes > MAX_TIMER_MINUTES) {
    return {
      ok: false,
      message: `The timer had been running for ${formatMinutes(minutes)}, which looks forgotten, so nothing was recorded. Add the time you actually worked by hand.`,
    };
  }

  const workDate = dayInTimeZone(timer.startedAt, FIRM_TIME_ZONE);
  const caseStillReachable = timer.caseId ? await hasCaseAccess(user, timer.caseId) : true;
  const alreadyThatDay = await minutesOnDay(user.id, workDate);
  const recordable = Math.min(minutes, Math.max(0, 24 * 60 - alreadyThatDay));
  if (recordable < 1) {
    return { ok: false, message: "That day already has 24 hours recorded; nothing was added." };
  }

  await prisma.timeEntry.create({
    data: {
      userId: user.id,
      caseId: caseStillReachable ? timer.caseId : null,
      workDate,
      minutes: recordable,
      activity: timer.activity,
      description: timer.description.trim() || "Timed work",
    },
  });

  revalidateTime([timer.caseId]);
  return { ok: true, message: `Recorded ${formatMinutes(recordable)}.` };
}

export async function startTimer(input: {
  caseId: string;
  activity: string;
  description: string;
}): Promise<TimerResult> {
  const user = await requireUser();

  const caseId = input.caseId.trim() || null;
  if (caseId && !(await hasCaseAccess(user, caseId))) {
    return { ok: false, message: "That case is not available to you." };
  }
  const activity = (TIME_ACTIVITY_ORDER as string[]).includes(input.activity)
    ? (input.activity as TimeActivity)
    : "OTHER";

  // Only one timer at a time: switching tasks records the previous stretch.
  const previous = await finishTimer(user);

  try {
    await prisma.runningTimer.create({
      data: {
        userId: user.id,
        caseId,
        activity,
        description: input.description.trim().slice(0, 1000),
        startedAt: new Date(),
      },
    });
  } catch {
    // Another tab started one between our stop and create.
    revalidatePath("/", "layout");
    return { ok: false, message: "A timer is already running. Refresh to see it." };
  }

  revalidatePath("/", "layout");
  // Surface what happened to the previous timer: recorded, or refused as forgotten.
  const earlier =
    previous.message && (previous.message.startsWith("Recorded") || !previous.ok)
      ? `${previous.message} `
      : "";
  return { ok: previous.ok, message: `${earlier}Timer started.` };
}

export async function stopTimer(): Promise<TimerResult> {
  const user = await requireUser();
  const result = await finishTimer(user);
  revalidatePath("/", "layout");
  return result;
}

export async function discardTimer(): Promise<TimerResult> {
  const user = await requireUser();
  await prisma.runningTimer.deleteMany({ where: { userId: user.id } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Timer discarded." };
}
