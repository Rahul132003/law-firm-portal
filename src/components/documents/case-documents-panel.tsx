"use client";
import { useState } from "react";
import { DocumentList, type DocumentRow } from "./document-list";
import { UploadForm } from "./upload-form";

/**
 * Ties the upload form to the list: choosing "New version" on a document
 * retargets the form so the upload joins that document's version chain
 * instead of starting a new one.
 */
export function CaseDocumentsPanel({
  caseId,
  documents,
  canDelete,
}: {
  caseId: string;
  documents: DocumentRow[];
  canDelete: boolean;
}) {
  const [replaces, setReplaces] = useState<{
    id: string;
    title: string;
  } | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <UploadForm caseId={caseId} replaces={replaces} />
        {replaces ? (
          <button
            type="button"
            onClick={() => setReplaces(null)}
            className="mt-2 text-xs text-secondary underline underline-offset-2 hover:text-primary"
          >
            Cancel — upload as a new document instead
          </button>
        ) : null}
      </div>

      <DocumentList
        documents={documents}
        canDelete={canDelete}
        onPickVersion={setReplaces}
      />
    </div>
  );
}
