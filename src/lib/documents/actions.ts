"use server";
import { revalidatePath } from "next/cache";
import type { DocumentCategory } from "@/generated/prisma/enums";
import { canDeleteDocuments } from "@/lib/auth/roles";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { DOCUMENT_CATEGORY_ORDER } from "./constants";
import { getDocumentForAccess, recordDocumentAudit } from "./queries";

export type DocumentActionResult = { ok: boolean; message?: string };

/**
 * Reclassify a document. Paralegals are explicitly permitted here — organising
 * documents is the core of their role.
 */
export async function recategorizeDocument(
  documentId: string,
  category: string,
): Promise<DocumentActionResult> {
  const document = await getDocumentForAccess(documentId);
  if (!document) {
    return { ok: false, message: "That document is not available to you." };
  }

  if (!(DOCUMENT_CATEGORY_ORDER as readonly string[]).includes(category)) {
    return { ok: false, message: "Unknown category." };
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { category: category as DocumentCategory },
  });

  revalidatePath(`/cases/${document.caseId}/documents`);
  revalidatePath("/documents");
  return { ok: true };
}

/**
 * Deletes one version of a document.
 *
 * The audit trail deliberately survives: AuditLog.documentId is set null by
 * the schema while documentTitle is retained, so "who downloaded this before * it was removed" stays answerable.
 */
export async function deleteDocument(
  documentId: string,
): Promise<DocumentActionResult> {
  const user = await requireUser();

  if (!canDeleteDocuments(user.role)) {
    return { ok: false, message: "Your role cannot delete documents." };
  }

  const document = await getDocumentForAccess(documentId);
  if (!document) {
    return { ok: false, message: "That document is not available to you." };
  }

  const record = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, fileUrl: true, rootDocumentId: true, isLatest: true },
  });

  if (!record) return { ok: false, message: "Already removed." };

  await recordDocumentAudit({
    userId: user.id,
    documentId: document.id,
    documentTitle: document.title,
    action: "DELETE",
  });

  const rootId = record.rootDocumentId ?? record.id;

  await prisma.$transaction(async (tx) => {
    await tx.document.delete({ where: { id: documentId } });

    // Removing the current version must promote the next newest, or the
    // document would vanish from the list while its history still exists.
    if (record.isLatest) {
      const next = await tx.document.findFirst({
        where: { OR: [{ id: rootId }, { rootDocumentId: rootId }] },
        orderBy: { version: "desc" },
        select: { id: true },
      });

      if (next) {
        await tx.document.update({
          where: { id: next.id },
          data: { isLatest: true },
        });
      }
    }
  });

  // Storage cleanup last: an orphaned object is recoverable, a row pointing at
  // deleted bytes is not.
  await getStorage().remove(record.fileUrl);

  revalidatePath(`/cases/${document.caseId}/documents`);
  revalidatePath("/documents");
  return { ok: true };
}
