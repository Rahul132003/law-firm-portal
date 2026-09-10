"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DocumentCategory } from "@/generated/prisma/enums";
import { deleteDocument, recategorizeDocument } from "@/lib/documents/actions";
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_ORDER,
  formatBytes,
} from "@/lib/documents/constants";

export type DocumentRow = {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: DocumentCategory;
  version: number;
  uploadedAt: Date;
  uploadedBy: { name: string };
  caseRef?: { id: string; caseNumber: string; title: string };
};

/**
 * Category chips are set as small-caps labels rather than seven coloured
 * pills. Seven tints would read as a rainbow against the off-white canvas, and the
 * category name is already unambiguous on its own — colour was adding
 * decoration, not information.
 *
 * The two categories that change what someone does next — a court Order and
 * a Judgment — keep a quiet accent so they can be spotted while scanning.
 */
const CATEGORY_TINT: Record<DocumentCategory, string> = {
  PETITION: "bg-sunken text-secondary",
  REPLY: "bg-sunken text-secondary",
  EVIDENCE: "bg-sunken text-secondary",
  ORDER: "bg-accent-50 text-accent-800",
  JUDGMENT: "bg-accent-50 text-accent-800",
  CORRESPONDENCE: "bg-sunken text-secondary",
  OTHER: "bg-sunken text-secondary",
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function DocumentList({
  documents,
  canDelete,
  showCase = false,
  onPickVersion,
}: {
  documents: DocumentRow[];
  canDelete: boolean;
  /** Firm-wide search shows which case each document belongs to. */
  showCase?: boolean;
  /** Per-case view offers "upload new version"; search results do not. */
  onPickVersion?: (doc: { id: string; title: string }) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <p className="card px-6 py-10 text-center text-sm text-muted">
        No documents match.
      </p>
    );
  }

  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {documents.map((doc) => (
          <li key={doc.id} className="card p-4">
            {" "}
            <div className="flex flex-wrap items-start justify-between gap-3">
              {" "}
              <div className="min-w-0 flex-1">
                {" "}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CATEGORY_TINT[doc.category]}`}
                  >
                    {DOCUMENT_CATEGORY_LABELS[doc.category]}
                  </span>
                  {doc.version > 1 ? (
                    <span className="rounded-md border border-hairline px-1.5 py-0.5 text-[11px] text-secondary">
                      v{doc.version}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 truncate text-sm font-medium text-primary">
                  {doc.title}
                </p>
                <p className="truncate font-mono text-xs text-muted">
                  {doc.fileName} · {formatBytes(doc.fileSize)}
                </p>
                {showCase && doc.caseRef ? (
                  <Link
                    href={`/cases/${doc.caseRef.id}/documents`}
                    className="mt-1 inline-block text-xs text-secondary underline-offset-2 hover:underline"
                  >
                    {doc.caseRef.caseNumber} — {doc.caseRef.title}
                  </Link>
                ) : null}
                <p className="mt-1 text-xs text-muted">
                  {doc.uploadedBy.name} · {formatDate(doc.uploadedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Both links go through the audited download route; the raw
                    storage ref is never exposed to the browser. */}
                <a
                  href={`/api/documents/${doc.id}/download?disposition=inline`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken hover:text-primary"
                >
                  View
                </a>
                <a
                  href={`/api/documents/${doc.id}/download`}
                  className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken hover:text-primary"
                >
                  Download
                </a>

                <Link
                  href={`/documents/${doc.id}/versions`}
                  className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken hover:text-primary"
                >
                  History
                </Link>

                {onPickVersion ? (
                  <button
                    type="button"
                    onClick={() =>
                      onPickVersion({ id: doc.id, title: doc.title })
                    }
                    className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken hover:text-primary"
                  >
                    New version
                  </button>
                ) : null}

                <label className="text-xs">
                  {" "}
                  <span className="sr-only">Category for {doc.title}</span>
                  <select
                    value={doc.category}
                    disabled={pending}
                    onChange={(event) => {
                      const next = event.target.value;
                      startTransition(async () => {
                        const result = await recategorizeDocument(doc.id, next);
                        if (!result.ok) {
                          setError(result.message ?? "Could not reclassify.");
                        } else {
                          router.refresh();
                        }
                      });
                    }}
                    className="cursor-pointer rounded-md border border-hairline bg-raised px-1.5 py-1 text-xs text-secondary"
                  >
                    {DOCUMENT_CATEGORY_ORDER.map((option) => (
                      <option key={option} value={option}>
                        {DOCUMENT_CATEGORY_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </label>

                {canDelete ? (
                  confirming === doc.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await deleteDocument(doc.id);
                            setConfirming(null);
                            if (!result.ok) {
                              setError(result.message ?? "Could not delete.");
                            } else {
                              router.refresh();
                            }
                          })
                        }
                        className="rounded-md border border-danger/30 px-2 py-1 text-xs font-medium text-danger"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="text-xs text-secondary hover:underline"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(doc.id)}
                      className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:border-danger/40 hover:text-danger"
                    >
                      Delete
                    </button>
                  )
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
