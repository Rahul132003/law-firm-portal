"use server";
import { revalidatePath } from "next/cache";
import { canManageHearings } from "@/lib/auth/roles";
import { encryptField } from "@/lib/crypto";
import { requireCapability, requireCaseAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { fieldErrors, hearingInputSchema } from "./validation";

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
