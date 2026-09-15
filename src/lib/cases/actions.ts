"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canCreateCases,
  canDeleteCase,
  canEditCase,
  canViewStrategyNotes,
  canWriteStrategyNotes,
} from "@/lib/auth/roles";
import { resolveClientId } from "@/lib/clients/resolve";
import {
  runConflictCheck,
  snapshotMatches,
  toPreview,
  type ConflictPreview,
  type ConflictReport,
} from "@/lib/conflicts/check";
import { normalisePartyName } from "@/lib/conflicts/match";
import { decideWaiver, readWaiver, type WaiverDecision } from "@/lib/conflicts/waiver";
import { encryptField } from "@/lib/crypto";
import { requireCapability, requireCaseAccess, requireUser } from "@/lib/dal";
import type { CaseStatus } from "@/generated/prisma/enums";
import { CASE_STATUS_LABELS } from "@/lib/cases/labels";
import { caseTeamIds, notify } from "@/lib/notifications/notify";
import { prisma } from "@/lib/prisma";

import {
  caseInputSchema,
  fieldErrors,
  noteInputSchema,
  parseAssignments,
  statusChangeSchema,
} from "./validation";

/**
 * Write side of case management.
 *
 * Server Actions are public HTTP endpoints, so each one independently
 * re-establishes who the caller is and whether they may touch this case.
 * Nothing here trusts a hidden form field or the referring page.
 */

export type CaseFormState = {
  errors?: Record<string, string>;
  message?: string;
  /** Set when a save was held back for conflict review. */
  conflicts?: ConflictPreview;
};

/**
 * Live conflict preview for the case form, run as the user fills in parties.
 * The authoritative check runs again on save; this one only informs.
 */
export async function previewConflicts(input: {
  clientName: string;
  opposingParty: string;
  excludeCaseId?: string;
}): Promise<ConflictPreview> {
  const user = await requireCapability(canEditCase);
  if (input.excludeCaseId) await requireCaseAccess(input.excludeCaseId);

  const report = await runConflictCheck(user, {
    clientName: input.clientName.slice(0, 160),
    opposingParty: input.opposingParty.slice(0, 200) || null,
    excludeCaseId: input.excludeCaseId,
  });
  return toPreview(report);
}

function conflictRecord(
  caseId: string,
  performedById: string,
  parties: { clientName: string; opposingParty: string | null },
  report: ConflictReport,
  waiver: Extract<WaiverDecision, { ok: true }>,
) {
  return {
    caseId,
    performedById,
    clientName: parties.clientName,
    opposingParty: parties.opposingParty,
    adverseMatches: report.adverse.length,
    relatedMatches: report.related.length,
    matches: snapshotMatches(report.raw),
    outcome: waiver.outcome,
    waiverReason: waiver.waiverReason,
  };
}

async function notifyAddedToCase(
  actor: { id: string; name: string },
  matter: { id: string; caseNumber: string; title: string },
  addedUserIds: string[],
) {
  await notify({
    kind: "CASE_ASSIGNED",
    recipientIds: addedUserIds,
    actorId: actor.id,
    title: `Added to ${matter.caseNumber}`,
    body: `${actor.name} added you to the team on "${matter.title}".`,
    linkUrl: `/cases/${matter.id}`,
  });
}

async function notifyStatusChanged(
  actor: { id: string; name: string },
  matter: { id: string; caseNumber: string; title: string },
  status: CaseStatus,
) {
  await notify({
    kind: "CASE_STATUS_CHANGED",
    recipientIds: await caseTeamIds(matter.id),
    actorId: actor.id,
    title: `${matter.caseNumber} is now ${CASE_STATUS_LABELS[status]}`,
    body: `${actor.name} moved "${matter.title}" to ${CASE_STATUS_LABELS[status]}.`,
    linkUrl: `/cases/${matter.id}`,
  });
}

/** Partners hear about every waiver, so none is recorded unseen. */
async function notifyPartnersOfWaiver(
  actor: { id: string; name: string },
  matter: { id: string; caseNumber: string; title: string },
  adverseCount: number,
) {
  const partners = await prisma.user.findMany({
    where: { role: "ADMIN_PARTNER", isActive: true },
    select: { id: true },
  });
  await notify({
    kind: "CONFLICT_WAIVED",
    recipientIds: partners.map((p) => p.id),
    actorId: actor.id,
    title: `Conflict waived on ${matter.caseNumber}`,
    body: `${actor.name} proceeded with "${matter.title}" despite ${adverseCount} possible conflict${adverseCount === 1 ? "" : "s"}. Review the recorded reason.`,
    linkUrl: `/cases/${matter.id}`,
  });
}

function readCaseForm(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  return {
    caseNumber: text("caseNumber"),
    title: text("title"),
    clientName: text("clientName"),
    caseType: text("caseType"),
    court: text("court"),
    jurisdiction: text("jurisdiction"),
    judge: text("judge"),
    opposingParty: text("opposingParty"),
    opposingCounsel: text("opposingCounsel"),
    status: text("status"),
    filedOn: text("filedOn"),
    assignments: parseAssignments(formData),
  };
}

export async function createCase(
  _prev: CaseFormState,
  formData: FormData,
): Promise<CaseFormState> {
  const user = await requireCapability(canCreateCases);

  const parsed = caseInputSchema.safeParse(readCaseForm(formData));
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { assignments, ...caseFields } = parsed.data;

  // Guarantee the case has at least one owner, otherwise a senior advocate
  // could create a matter that immediately vanishes from their own list.
  const finalAssignments =
    assignments.length > 0
      ? assignments
      : [{ userId: user.id, roleOnCase: "LEAD_COUNSEL" as const }];

  const duplicate = await prisma.case.findUnique({
    where: { caseNumber: caseFields.caseNumber },
    select: { id: true },
  });

  if (duplicate) {
    return {
      errors: { caseNumber: "A case with this number already exists." },
    };
  }

  const report = await runConflictCheck(user, {
    clientName: caseFields.clientName,
    opposingParty: caseFields.opposingParty,
  });
  const waiver = decideWaiver(
    { adverseCount: report.adverse.length, fingerprint: report.fingerprint },
    readWaiver(formData),
  );
  if (!waiver.ok) {
    return { message: waiver.message, errors: waiver.errors, conflicts: toPreview(report) };
  }

  let createdId: string;

  try {
    createdId = await prisma.$transaction(async (tx) => {
      const clientId = await resolveClientId(tx, caseFields.clientName);
      const created = await tx.case.create({
        data: {
          ...caseFields,
          clientId,
          assignments: {
            create: finalAssignments.map((entry) => ({
              userId: entry.userId,
              roleOnCase: entry.roleOnCase,
            })),
          },
        },
        select: { id: true },
      });
      await tx.conflictCheck.create({
        data: conflictRecord(created.id, user.id, caseFields, report, waiver),
      });
      return created.id;
    });
  } catch {
    return { message: "Could not create the case. Please try again." };
  }

  const matter = { id: createdId, caseNumber: caseFields.caseNumber, title: caseFields.title };
  await notifyAddedToCase(user, matter, finalAssignments.map((entry) => entry.userId));
  if (waiver.outcome === "WAIVED") {
    await notifyPartnersOfWaiver(user, matter, report.adverse.length);
  }

  revalidatePath("/cases");
  redirect(`/cases/${createdId}`);
}

export async function updateCase(
  caseId: string,
  _prev: CaseFormState,
  formData: FormData,
): Promise<CaseFormState> {
  await requireCapability(canEditCase);
  const { user } = await requireCaseAccess(caseId);

  const parsed = caseInputSchema.safeParse(readCaseForm(formData));
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { assignments, ...caseFields } = parsed.data;

  const before = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      status: true,
      clientName: true,
      opposingParty: true,
      clientId: true,
      assignments: { select: { userId: true } },
    },
  });
  if (!before) return { message: "This case no longer exists." };

  const same = (a: string | null, b: string | null) =>
    normalisePartyName(a ?? "") === normalisePartyName(b ?? "");
  const clientChanged = !same(before.clientName, caseFields.clientName);
  const partiesChanged =
    clientChanged || !same(before.opposingParty, caseFields.opposingParty);

  // Re-check only when the parties changed: editing a hearing court must not
  // demand a fresh waiver for a conflict that was already reviewed.
  const report = partiesChanged
    ? await runConflictCheck(user, {
        clientName: caseFields.clientName,
        opposingParty: caseFields.opposingParty,
        excludeCaseId: caseId,
      })
    : null;
  const waiver = report
    ? decideWaiver(
        { adverseCount: report.adverse.length, fingerprint: report.fingerprint },
        readWaiver(formData),
      )
    : null;
  if (report && waiver && !waiver.ok) {
    return { message: waiver.message, errors: waiver.errors, conflicts: toPreview(report) };
  }

  const duplicate = await prisma.case.findFirst({
    where: { caseNumber: caseFields.caseNumber, NOT: { id: caseId } },
    select: { id: true },
  });

  if (duplicate) {
    return {
      errors: { caseNumber: "Another case already uses this number." },
    };
  }

  try {
    // Replacing assignments wholesale keeps the editor's semantics simple;
    // the transaction stops a failure from leaving a case with nobody on it.
    await prisma.$transaction(async (tx) => {
      const clientId =
        clientChanged || !before.clientId
          ? await resolveClientId(tx, caseFields.clientName)
          : before.clientId;

      await tx.case.update({ where: { id: caseId }, data: { ...caseFields, clientId } });
      await tx.caseAssignment.deleteMany({ where: { caseId } });
      await tx.caseAssignment.createMany({
        data: assignments.map((entry) => ({
          caseId,
          userId: entry.userId,
          roleOnCase: entry.roleOnCase,
        })),
        skipDuplicates: true,
      });

      if (report && waiver?.ok) {
        await tx.conflictCheck.create({
          data: conflictRecord(caseId, user.id, caseFields, report, waiver),
        });
      }
    });
  } catch {
    return { message: "Could not save changes. Please try again." };
  }

  const matter = { id: caseId, caseNumber: caseFields.caseNumber, title: caseFields.title };
  const previousTeam = new Set(before.assignments.map((a) => a.userId));
  await notifyAddedToCase(
    user,
    matter,
    assignments.map((entry) => entry.userId).filter((id) => !previousTeam.has(id)),
  );
  if (report && waiver?.ok && waiver.outcome === "WAIVED") {
    await notifyPartnersOfWaiver(user, matter, report.adverse.length);
  }
  if (before.status !== caseFields.status) {
    await notifyStatusChanged(user, matter, caseFields.status);
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}

/** Kanban drag-and-drop and the status dropdown both land here. */
export async function updateCaseStatus(
  caseId: string,
  status: string,
): Promise<{ ok: boolean; message?: string }> {
  await requireCapability(canEditCase);
  const { user } = await requireCaseAccess(caseId);

  const parsed = statusChangeSchema.safeParse({ caseId, status });
  if (!parsed.success) {
    return { ok: false, message: "That is not a valid status." };
  }

  const before = await prisma.case.findUnique({
    where: { id: caseId },
    select: { caseNumber: true, title: true, status: true },
  });
  if (!before) return { ok: false, message: "This case no longer exists." };

  await prisma.case.update({
    where: { id: caseId },
    data: { status: parsed.data.status },
  });

  // A card dropped back into its own column is not news.
  if (before.status !== parsed.data.status) {
    await notifyStatusChanged(user, { id: caseId, ...before }, parsed.data.status);
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

export async function deleteCase(caseId: string): Promise<void> {
  await requireCapability(canDeleteCase);
  await requireCaseAccess(caseId);

  // Documents, hearings, tasks, notes and assignments cascade at the schema
  // level. AuditLog rows deliberately survive (documentId is set null).
  await prisma.case.delete({ where: { id: caseId } });

  revalidatePath("/cases");
  redirect("/cases");
}

export type NoteFormState = {
  errors?: Record<string, string>;
  message?: string;
};

export async function addCaseNote(
  caseId: string,
  _prev: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const { user } = await requireCaseAccess(caseId);

  const visibilityInput = formData.get("visibility");
  const parsed = noteInputSchema.safeParse({
    caseId,
    body: typeof formData.get("body") === "string" ? formData.get("body") : "",
    visibility:
      typeof visibilityInput === "string" ? visibilityInput : "CASE_TEAM",
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  // A paralegal may leave a case-team note but must never author — or even
  // request — a strategy note.
  if (
    parsed.data.visibility === "STRATEGY" &&
    !canWriteStrategyNotes(user.role)
  ) {
    return { message: "Your role cannot post strategy notes." };
  }

  await prisma.caseNote.create({
    data: {
      caseId,
      authorId: user.id,
      body: encryptField(parsed.data.body),
      visibility: parsed.data.visibility,
    },
  });

  // The note text is never copied into a notification: notes are encrypted at
  // rest and notifications are not, and push can reach a lock screen.
  const team = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      caseNumber: true,
      assignments: { select: { userId: true, user: { select: { role: true } } } },
    },
  });
  if (team) {
    const isStrategy = parsed.data.visibility === "STRATEGY";
    await notify({
      kind: "NOTE_ADDED",
      recipientIds: team.assignments
        .filter((a) => !isStrategy || canViewStrategyNotes(a.user.role))
        .map((a) => a.userId),
      actorId: user.id,
      title: `${isStrategy ? "Strategy note" : "New note"} on ${team.caseNumber}`,
      body: `${user.name} added a ${isStrategy ? "strategy " : ""}note.`,
      linkUrl: `/cases/${caseId}/notes`,
    });
  }

  revalidatePath(`/cases/${caseId}/notes`);
  return {};
}

export async function deleteCaseNote(noteId: string): Promise<void> {
  const user = await requireUser();

  const note = await prisma.caseNote.findUnique({
    where: { id: noteId },
    select: { id: true, caseId: true, authorId: true },
  });

  if (!note) return;

  // Confirms the caller can reach the case at all before anything else.
  await requireCaseAccess(note.caseId);

  // Only the author may remove their own note; partners may remove any.
  if (note.authorId !== user.id && user.role !== "ADMIN_PARTNER") {
    return;
  }

  await prisma.caseNote.delete({ where: { id: noteId } });
  revalidatePath(`/cases/${note.caseId}/notes`);
}
