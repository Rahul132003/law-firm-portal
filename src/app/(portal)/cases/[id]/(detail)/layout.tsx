import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseTabs } from "@/components/cases/case-tabs";
import { DeleteCaseButton } from "@/components/cases/delete-case-button";
import { StatusBadge, TypeBadge } from "@/components/cases/status-badge";
import { buttonClass } from "@/components/ui/button";
import { canDeleteCase, canEditCase } from "@/lib/auth/roles";
import { getCaseDetail, getCaseTabCounts } from "@/lib/cases/queries";

/**
 * Shell for the case detail tabs.
 *
 * Lives in a `(detail)` route group so that /cases/[id]/edit — which sits
 * outside the group — does not inherit the tab chrome.
 */
export default async function CaseDetailLayout({
  children,
  params,
}: LayoutProps<"/cases/[id]">) {
  const { id } = await params;

  // Performs the row-level access check; throws 403 if out of scope.
  const record = await getCaseDetail(id);
  if (!record) notFound();

  const counts = await getCaseTabCounts(id);
  const viewer = record.viewer;

  return (
    <div className="mx-auto max-w-5xl">
      {" "}
      <nav className="mb-4 text-sm">
        <Link
          href="/cases"
          className="text-secondary underline-offset-2 hover:underline"
        >
          ← Cases
        </Link>
      </nav>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        {" "}
        <div className="min-w-0">
          {" "}
          <div className="flex flex-wrap items-center gap-2">
            {" "}
            <span className="font-mono text-xs text-muted">
              {record.caseNumber}
            </span>
            <TypeBadge caseType={record.caseType} />
            <StatusBadge status={record.status} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary">
            {record.title}
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {record.clientName} · {record.court}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEditCase(viewer.role) ? (
            <Link
              href={`/cases/${id}/edit`}
              className={buttonClass("secondary", "sm")}
            >
              Edit
            </Link>
          ) : null}
          {canDeleteCase(viewer.role) ? (
            <DeleteCaseButton caseId={id} caseTitle={record.title} />
          ) : null}
        </div>
      </header>
      <CaseTabs
        caseId={id}
        tabs={[
          { segment: "", label: "Overview" },
          { segment: "documents", label: "Documents", count: counts.documents },
          { segment: "hearings", label: "Hearings", count: counts.hearings },
          { segment: "tasks", label: "Tasks", count: counts.tasks },
          { segment: "notes", label: "Notes", count: counts.notes },
        ]}
      />
      <div className="pt-6">{children}</div>
    </div>
  );
}
