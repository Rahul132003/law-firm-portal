"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canCreateCases,
  canDeleteCase,
  canEditCase,
  canWriteStrategyNotes,
} from "@/lib/auth/roles";
import { encryptField } from "@/lib/crypto";
import { requireCapability, requireCaseAccess, requireUser } from "@/lib/dal";
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
};

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

  let createdId: string;

  try {
    const created = await prisma.case.create({
      data: {
        ...caseFields,
        assignments: {
          create: finalAssignments.map((entry) => ({
            userId: entry.userId,
            roleOnCase: entry.roleOnCase,
          })),
        },
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch {
    return { message: "Could not create the case. Please try again." };
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
  await requireCaseAccess(caseId);

  const parsed = caseInputSchema.safeParse(readCaseForm(formData));
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { assignments, ...caseFields } = parsed.data;

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
    await prisma.$transaction([
      prisma.case.update({ where: { id: caseId }, data: caseFields }),
      prisma.caseAssignment.deleteMany({ where: { caseId } }),
      prisma.caseAssignment.createMany({
        data: assignments.map((entry) => ({
          caseId,
          userId: entry.userId,
          roleOnCase: entry.roleOnCase,
        })),
        skipDuplicates: true,
      }),
    ]);
  } catch {
    return { message: "Could not save changes. Please try again." };
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
  await requireCaseAccess(caseId);

  const parsed = statusChangeSchema.safeParse({ caseId, status });
  if (!parsed.success) {
    return { ok: false, message: "That is not a valid status." };
  }

  await prisma.case.update({
    where: { id: caseId },
    data: { status: parsed.data.status },
  });

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
