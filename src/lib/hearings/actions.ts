"use server";
import { revalidatePath } from "next/cache";
import { canManageHearings } from "@/lib/auth/roles";
import { encryptField } from "@/lib/crypto";
import { requireCapability, requireCaseAccess, requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { fieldErrors, hearingInputSchema } from "./validation";
import { listHearingsOnDate } from "./queries";

export type HearingFormState = {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
};

function readForm(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  return {
    date: text("date"),
    court: text("court"),
    purpose: text("purpose"),
    notes: text("notes"),
    nextDate: text("nextDate"),
  };
}

export async function createHearing(
  caseId: string,
  _prev: HearingFormState,
  formData: FormData,
): Promise<HearingFormState> {
  await requireCapability(canManageHearings);
  await requireCaseAccess(caseId);

  const parsed = hearingInputSchema.safeParse(readForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { notes, ...rest } = parsed.data;

  await prisma.hearing.create({
    data: {
      caseId,
      ...rest,
      // Same treatment as case strategy notes — sealed before storage.
      notes: notes ? encryptField(notes) : null,
    },
  });

  revalidatePath(`/cases/${caseId}/hearings`);
  revalidatePath("/diary");
  return { ok: true };
}

export async function updateHearing(
  hearingId: string,
  _prev: HearingFormState,
  formData: FormData,
): Promise<HearingFormState> {
  await requireCapability(canManageHearings);

  const existing = await prisma.hearing.findUnique({
    where: { id: hearingId },
    select: { caseId: true },
  });

  if (!existing) return { message: "That hearing no longer exists." };
  await requireCaseAccess(existing.caseId);

  const parsed = hearingInputSchema.safeParse(readForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { notes, ...rest } = parsed.data;

  await prisma.hearing.update({
    where: { id: hearingId },
    data: { ...rest, notes: notes ? encryptField(notes) : null },
  });

  revalidatePath(`/cases/${existing.caseId}/hearings`);
  revalidatePath("/diary");
  return { ok: true };
}

export async function deleteHearing(
  hearingId: string,
): Promise<{ ok: boolean; message?: string }> {
  await requireCapability(canManageHearings);

  const existing = await prisma.hearing.findUnique({
    where: { id: hearingId },
    select: { caseId: true },
  });

  if (!existing) return { ok: true };
  await requireCaseAccess(existing.caseId);

  // HearingReminder rows cascade, so a rescheduled-then-deleted hearing
  // leaves no orphaned dispatch records behind.
  await prisma.hearing.delete({ where: { id: hearingId } });

  revalidatePath(`/cases/${existing.caseId}/hearings`);
  revalidatePath("/diary");
  return { ok: true };
}

/**
 * Focused update for the diary's inline "next date" editor — touches only
 * that one field, so a quick correction from the calendar does not require
 * resending the full hearing form (date, court, purpose, notes).
 */
export async function updateHearingNextDate(
  hearingId: string,
  nextDateValue: string,
): Promise<{ ok: boolean; message?: string }> {
  await requireCapability(canManageHearings);

  const existing = await prisma.hearing.findUnique({
    where: { id: hearingId },
    select: { caseId: true, date: true },
  });

  if (!existing) return { ok: false, message: "That hearing no longer exists." };
  await requireCaseAccess(existing.caseId);

  const trimmed = nextDateValue.trim();
  let nextDate: Date | null = null;

  if (trimmed !== "") {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, message: "That is not a valid date." };
    }
    // Same rule as the full hearing form's schema: a next date on or before
    // the hearing it follows is not meaningful.
    if (parsed.getTime() <= existing.date.getTime()) {
      return { ok: false, message: "The next hearing must be after this one." };
    }
    nextDate = parsed;
  }

  await prisma.hearing.update({
    where: { id: hearingId },
    data: { nextDate },
  });

  revalidatePath(`/cases/${existing.caseId}/hearings`);
  revalidatePath("/diary");
  return { ok: true };
}

export type DateClashHearing = {
  id: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  court: string;
  date: Date;
};

/**
 * Powers the "other matters already listed that day" warning shown while
 * picking a next hearing date. A plain read — access is scoped the same way
 * the rest of the diary is, through `caseScopeFilter`, not gated behind the
 * edit capability, since seeing what is on a date is no more sensitive than
 * the calendar itself.
 */
export async function getHearingsOnDate(
  dateValue: string,
): Promise<DateClashHearing[]> {
  const trimmed = dateValue.trim();
  if (!trimmed) return [];

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return [];

  const user = await requireUser();
  const rows = await listHearingsOnDate(user, parsed);

  return rows.map((row) => ({
    id: row.id,
    caseId: row.caseId,
    caseNumber: row.case.caseNumber,
    caseTitle: row.case.title,
    court: row.court,
    date: row.date,
  }));
}
