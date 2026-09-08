import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canViewAuditLog } from "@/lib/auth/roles";
import {
  DOCUMENT_CATEGORY_LABELS,
  formatBytes,
} from "@/lib/documents/constants";
import {
  getDocumentAuditTrail,
  getDocumentForAccess,
  getDocumentVersions,
} from "@/lib/documents/queries";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `Document history · ${FIRM_NAME}`,
};

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

const ACTION_LABELS: Record<string, string> = {
  VIEW: "Viewed",
  DOWNLOAD: "Downloaded",
  UPLOAD: "Uploaded",
  DELETE: "Deleted",
};

export default async function DocumentVersionsPage(
  props: PageProps<"/documents/[id]/versions">,
) {
  const { id } = await props.params;
  const user = await requireUser();

  // Scoped: resolves only if the caller can reach the owning case.
  const document = await getDocumentForAccess(id);
  if (!document) notFound();

  const versions = await getDocumentVersions(id);
  const showAudit = canViewAuditLog(user.role);
  const audit = showAudit ? await getDocumentAuditTrail(id) : [];

  return (
    <div className="mx-auto max-w-3xl">
      {" "}
      <nav className="mb-4 text-sm">
        <Link
          href={`/cases/${document.caseId}/documents`}
          className="text-secondary underline-offset-2 hover:underline"
        >
          ← {document.case.caseNumber} documents
        </Link>
      </nav>
      <header className="mb-6">
        {" "}
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          {document.title}
        </h1>
        <p className="mt-1 text-sm text-secondary">
          {" "}
          {DOCUMENT_CATEGORY_LABELS[document.category]} · {versions.length}{" "}
          version{versions.length === 1 ? "" : "s"}
        </p>
      </header>
      <section className="card p-5">
        {" "}
        <h2 className="mb-4 text-sm font-semibold text-primary">
          Version history
        </h2>
        <ol className="space-y-3">
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center gap-3 border-b border-hairline pb-3 last:border-0 last:pb-0"
            >
              <span
                className={
                  version.isLatest
                    ? "grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-xs font-semibold text-white"
                    : "grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-secondary"
                }
              >
                v{version.version}
              </span>

              <span className="min-w-0 flex-1">
                {" "}
                <span className="block truncate font-mono text-xs text-secondary">
                  {version.fileName}
                </span>
                <span className="block text-xs text-muted">
                  {" "}
                  {version.uploadedBy.name} ·{" "}
                  {formatTimestamp(version.uploadedAt)} ·{" "}
                  {formatBytes(version.fileSize)}
                </span>
              </span>

              {version.isLatest ? (
                <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-secondary">
                  Current
                </span>
              ) : null}

              <a
                href={`/api/documents/${version.id}/download`}
                className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken hover:text-primary"
              >
                Download
              </a>
            </li>
          ))}
        </ol>
      </section>
      {showAudit ? (
        <section className="card mt-5 p-5">
          {" "}
          <h2 className="text-sm font-semibold text-primary">
            Access log
          </h2>{" "}
          <p className="mt-1 mb-4 text-xs text-secondary">
            Who has viewed or downloaded this document. Visible to partners
            only.
          </p>
          {audit.length === 0 ? (
            <p className="text-sm text-muted">No access recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {audit.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-secondary">
                    {" "}
                    {ACTION_LABELS[entry.action] ?? entry.action} by{" "}
                    <span className="text-primary">{entry.user.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
