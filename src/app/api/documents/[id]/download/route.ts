import { NextResponse } from "next/server";

import {
  getDocumentWithRef,
  recordDocumentAudit,
} from "@/lib/documents/queries";
import { getStorage } from "@/lib/storage";

/**
 * The only path by which document bytes leave the system.
 *
 * Storage refs (private blob URLs, local paths) are never sent to the browser.
 * Every read is authorised against the case assignment first and written to
 * the audit trail second, which is what makes the AuditLog a complete record
 * of who saw what.
 *
 * `?disposition=inline` renders in the browser and is logged as a VIEW;
 * the default forces a download and is logged as a DOWNLOAD.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/documents/[id]/download">,
) {
  const { id } = await ctx.params;

  // Scoped lookup: a document on an unreachable case simply does not resolve.
  const result = await getDocumentWithRef(id);

  if (!result) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { document, user } = result;

  const inline =
    new URL(request.url).searchParams.get("disposition") === "inline";

  const stream = await getStorage().getStream(document.fileUrl);

  if (!stream) {
    console.error(
      `Document ${document.id} has no backing object at its storage ref.`,
    );
    return NextResponse.json(
      { error: "The stored file is missing." },
      { status: 410 },
    );
  }

  await recordDocumentAudit({
    userId: user.id,
    documentId: document.id,
    documentTitle: document.title,
    action: inline ? "VIEW" : "DOWNLOAD",
    ipAddress: request.headers.get("x-forwarded-for"),
  });

  // Quote-escape the filename so a comma or quote cannot break the header.
  const asciiName = document.fileName.replace(/["\\]/g, "_");

  return new NextResponse(stream, {
    headers: {
      "Content-Type": document.fileType,
      "Content-Length": String(document.fileSize),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      // Privileged material must not sit in shared caches.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
