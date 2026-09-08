"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { DocumentCategory } from "@/generated/prisma/enums";
import {
  categorizeFileName,
  titleFromFileName,
} from "@/lib/documents/categorize";
import {
  ACCEPT_ATTRIBUTE,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_ORDER,
  MAX_UPLOAD_BYTES,
  formatBytes,
} from "@/lib/documents/constants";

/**
 * Uploads via fetch to a Route Handler rather than a Server Action, because
 * action bodies are capped at 1MB. Using XHR would buy an upload progress
 * bar; fetch keeps it simple and these files are small enough that the
 * pending state is adequate.
 */
export function UploadForm({
  caseId,
  replaces,
}: {
  caseId: string;
  /** When set, this upload becomes the next version of an existing document. */
  replaces?: { id: string; title: string } | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(replaces?.title ?? "");
  const [category, setCategory] = useState<DocumentCategory>("OTHER");
  const [fileLabel, setFileLabel] = useState<string | null>(null);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);

    if (!file) {
      setFileLabel(null);
      return;
    }

    setFileLabel(`${file.name} · ${formatBytes(file.size)}`);

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      );
    }

    // Pre-fill from the filename, but only where the user has not typed
    // something themselves.
    if (!replaces) {
      setCategory(categorizeFileName(file.name));
      setTitle((current) => current || titleFromFileName(file.name));
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    if (replaces) formData.set("replacesDocumentId", replaces.id);

    setPending(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? `Upload failed (${response.status}).`);
        return;
      }

      formRef.current?.reset();
      setTitle("");
      setFileLabel(null);
      setCategory("OTHER");
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card p-4">
      {" "}
      <h3 className="text-sm font-semibold text-primary">
        {replaces
          ? `Upload a new version of “${replaces.title}”`
          : "Upload a document"}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {" "}
        <div className="sm:col-span-2">
          {" "}
          <label htmlFor="file" className="field-label">
            File
          </label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept={ACCEPT_ATTRIBUTE}
            onChange={onFileChange}
            disabled={pending}
            className="field-input file:mr-3 file:rounded file:border-0 file:bg-sunken file:px-2 file:py-1 file:text-xs file:text-secondary"
          />
          {fileLabel ? (
            <p className="mt-1 text-xs text-muted">{fileLabel}</p>
          ) : (
            <p className="mt-1 text-xs text-muted">
              {" "}
              PDF, Word, Excel, text or image. Up to{" "}
              {formatBytes(MAX_UPLOAD_BYTES)}.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="doc-title" className="field-label">
            Title
          </label>
          <input
            id="doc-title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={pending}
            placeholder="Defaults to the filename"
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="doc-category" className="field-label">
            {" "}
            Category{" "}
            <span className="text-muted">(auto-detected, editable)</span>
          </label>
          <select
            id="doc-category"
            name="category"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as DocumentCategory)
            }
            disabled={pending}
            className="field-input cursor-pointer"
          >
            {DOCUMENT_CATEGORY_ORDER.map((option) => (
              <option key={option} value={option}>
                {DOCUMENT_CATEGORY_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Uploading…" : replaces ? "Upload new version" : "Upload"}
        </button>
        {pending ? (
          <span className="text-xs text-muted" aria-live="polite">
            Do not close this tab.
          </span>
        ) : null}
      </div>
    </form>
  );
}
