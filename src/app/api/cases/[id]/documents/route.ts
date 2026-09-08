import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { DocumentCategory } from "@/generated/prisma/enums";
import {
  categorizeFileName,
  titleFromFileName,
} from "@/lib/documents/categorize";
import {
  ALLOWED_MIME_TYPES,
  DOCUMENT_CATEGORY_ORDER,
  MAX_UPLOAD_BYTES,
} from "@/lib/documents/constants";
import { recordDocumentAudit } from "@/lib/documents/queries";
import { getSessionUser, requireCaseAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";

/**
 * Document upload.
 *
 * Deliberately a Route Handler rather than a Server Action: action request
 * bodies are capped at 1MB by default, which scanned court records exceed
 * routinely. Route handlers stream the request body instead.
 */

/** Keeps user-supplied names out of the storage path entirely. */
function safeFileName(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_{2,}/g, "_")
      .slice(-120) || "upload"
  );
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/cases/[id]/documents">,
) {
  const { id: caseId } = await ctx.params;

  // This endpoint is called by fetch, so an expired session must come back as
  // JSON the client can act on — `requireCaseAccess` alone would redirect to
  // the HTML login page, which a fetch caller cannot do anything useful with.
  if (!(await getSessionUser())) {
    return NextResponse.json(
      { error: "Your session has expired. Reload the page and sign in again." },
      { status: 401 },
    );
  }

  // Throws 403 if the caller is not on this case. Paralegals reach here too —
  // document handling is explicitly part of their role.
  const { user } = await requireCaseAccess(caseId);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return bad("Could not read the upload.");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return bad("Choose a file to upload.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return bad(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${
        MAX_UPLOAD_BYTES / 1024 / 1024
      } MB.`,
      413,
    );
  }

  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES[contentType]) {
    return bad(`Files of type "${contentType}" are not accepted.`, 415);
  }

  const rawTitle = formData.get("title");
  const title =
    typeof rawTitle === "string" && rawTitle.trim()
      ? rawTitle.trim().slice(0, 200)
      : titleFromFileName(file.name);

  const rawCategory = formData.get("category");
  const category: DocumentCategory =
    typeof rawCategory === "string" &&
    (DOCUMENT_CATEGORY_ORDER as readonly string[]).includes(rawCategory)
      ? (rawCategory as DocumentCategory)
      : categorizeFileName(file.name);

  // When present, this upload is a new version of an existing document.
  const rawReplaces = formData.get("replacesDocumentId");
  const replacesId =
    typeof rawReplaces === "string" && rawReplaces.trim()
      ? rawReplaces.trim()
      : null;

  let rootId: string | null = null;
  let version = 1;

  if (replacesId) {
    const previous = await prisma.document.findFirst({
      // Constrained to the same case, so a version chain cannot be used to
      // graft a document onto a case the uploader cannot reach.
      where: { id: replacesId, caseId },
      select: { id: true, rootDocumentId: true },
    });

    if (!previous) {
      return bad("The document you are replacing is not on this case.", 404);
    }

    rootId = previous.rootDocumentId ?? previous.id;

    const highest = await prisma.document.aggregate({
      where: { OR: [{ id: rootId }, { rootDocumentId: rootId }] },
      _max: { version: true },
    });

    version = (highest._max.version ?? 0) + 1;
  }

  const storage = getStorage();
  const key = `cases/${caseId}/${randomUUID()}-${safeFileName(file.name)}`;

  let stored;
  try {
    stored = await storage.put(
      key,
      Buffer.from(await file.arrayBuffer()),
      contentType,
    );
  } catch (error) {
    console.error("Document upload to storage failed", error);
    return bad("Could not store the file. Please try again.", 502);
  }

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      if (rootId) {
        // Only one version in a chain may be current.
        await tx.document.updateMany({
          where: { OR: [{ id: rootId }, { rootDocumentId: rootId }] },
          data: { isLatest: false },
        });
      }

      return tx.document.create({
        data: {
          caseId,
          title,
          fileName: file.name.slice(-200),
          fileUrl: stored.ref,
          fileType: contentType,
          fileSize: stored.size,
          category,
          uploadedById: user.id,
          version,
          rootDocumentId: rootId,
          isLatest: true,
        },
        select: { id: true, title: true, version: true },
      });
    });
  } catch (error) {
    // Do not leave an orphaned object behind if the row could not be written.
    await storage.remove(stored.ref);
    console.error("Document record creation failed", error);
    return bad("Could not save the document record.", 500);
  }

  await recordDocumentAudit({
    userId: user.id,
    documentId: created.id,
    documentTitle: created.title,
    action: "UPLOAD",
    ipAddress: request.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({
    id: created.id,
    title: created.title,
    version: created.version,
  });
}
