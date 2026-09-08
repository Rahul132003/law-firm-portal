import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction, DocumentCategory } from "@/generated/prisma/enums";
import {
  caseScopeFilter,
  requireCaseAccess,
  requireUser,
  type SessionUser,
} from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Read side of document management.
 *
 * Documents inherit their access rules from the case they belong to: every
 * query is constrained by `caseScopeFilter`, so a user who cannot see a case
 * cannot see, search, or download its documents either.
 */

const documentSelect = {
  id: true,
  title: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  category: true,
  version: true,
  rootDocumentId: true,
  isLatest: true,
  uploadedAt: true,
  caseId: true,
  uploadedBy: { select: { id: true, name: true } },
  case: { select: { id: true, caseNumber: true, title: true } },
} satisfies Prisma.DocumentSelect;

export type DocumentSummary = Prisma.DocumentGetPayload<{
  select: typeof documentSelect;
}>;

export type DocumentFilters = {
  category?: DocumentCategory;
  q?: string;
};

function searchClause(q?: string): Prisma.DocumentWhereInput[] {
  if (!q) return [];

  // Metadata search only. Document *bodies* are never indexed: the brief
  // scopes search to metadata and filenames, and indexing contents would
  // create a second copy of privileged material outside the blob store.
  return [
    {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { fileName: { contains: q, mode: "insensitive" } },
        { case: { caseNumber: { contains: q, mode: "insensitive" } } },
        { case: { title: { contains: q, mode: "insensitive" } } },
      ],
    },
  ];
}

/** Latest version of each document on one case. */
export async function listCaseDocuments(
  caseId: string,
  filters: DocumentFilters = {},
): Promise<DocumentSummary[]> {
  await requireCaseAccess(caseId);

  return prisma.document.findMany({
    where: {
      caseId,
      isLatest: true,
      ...(filters.category ? { category: filters.category } : {}),
      AND: searchClause(filters.q),
    },
    select: documentSelect,
    orderBy: [{ uploadedAt: "desc" }],
  });
}

/**
 * Firm-wide document search, constrained to cases the user can reach.
 * This is the /documents page.
 */
export async function searchDocuments(
  user: SessionUser,
  filters: DocumentFilters,
): Promise<DocumentSummary[]> {
  const scope = await caseScopeFilter(user);

  return prisma.document.findMany({
    where: {
      isLatest: true,
      // `case: scope` is the row-level constraint. For an admin this is `{}`.
      case: scope,
      ...(filters.category ? { category: filters.category } : {}),
      AND: searchClause(filters.q),
    },
    select: documentSelect,
    orderBy: [{ uploadedAt: "desc" }],
    take: 200,
  });
}

/**
 * Every version of one document, newest first. Accepts any version's id and
 * resolves the whole chain from its root.
 */
export async function getDocumentVersions(
  documentId: string,
): Promise<DocumentSummary[]> {
  const anchor = await getDocumentForAccess(documentId);
  if (!anchor) return [];

  const rootId = anchor.rootDocumentId ?? anchor.id;

  return prisma.document.findMany({
    where: { OR: [{ id: rootId }, { rootDocumentId: rootId }] },
    select: documentSelect,
    orderBy: [{ version: "desc" }],
  });
}

/**
 * Fetches a document only if the caller may reach its case. Returns null
 * rather than throwing, so callers can choose between 403 and 404.
 */
export async function getDocumentForAccess(
  documentId: string,
): Promise<DocumentSummary | null> {
  const user = await requireUser();
  const scope = await caseScopeFilter(user);

  return prisma.document.findFirst({
    where: { id: documentId, case: scope },
    select: documentSelect,
  });
}

/** Internal variant that also returns the storage ref, which never goes to the client. */
export async function getDocumentWithRef(documentId: string) {
  const user = await requireUser();
  const scope = await caseScopeFilter(user);

  const document = await prisma.document.findFirst({
    where: { id: documentId, case: scope },
    select: { ...documentSelect, fileUrl: true },
  });

  return document ? { document, user } : null;
}

/**
 * Appends to the audit trail. Never throws into the caller's path — losing a
 * download because logging failed would be the wrong trade — but failures are
 * surfaced in the server log.
 */
export async function recordDocumentAudit(params: {
  userId: string;
  documentId: string | null;
  documentTitle: string;
  action: AuditAction;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        documentId: params.documentId,
        documentTitle: params.documentTitle,
        action: params.action,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log entry", error);
  }
}

/** Audit trail for one document, newest first. Admin-only surface. */
export async function getDocumentAuditTrail(documentId: string) {
  return prisma.auditLog.findMany({
    where: { documentId },
    select: {
      id: true,
      action: true,
      timestamp: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { timestamp: "desc" },
    take: 100,
  });
}

/** Distinct categories present in the user's reachable documents. */
export async function getDocumentCategoryCounts(user: SessionUser) {
  const scope = await caseScopeFilter(user);

  const rows = await prisma.document.groupBy({
    by: ["category"],
    where: { isLatest: true, case: scope },
    _count: { _all: true },
  });

  return rows.map((row) => ({
    category: row.category,
    count: row._count._all,
  }));
}
