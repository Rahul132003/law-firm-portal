import Link from "next/link";
import { notFound } from "next/navigation";
import { CASE_ROLE_LABELS } from "@/lib/cases/labels";
import { getCaseDetail } from "@/lib/cases/queries";
import { getLatestConflictCheck } from "@/lib/clients/queries";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-primary">{value || "—"}</dd>
    </div>
  );
}

export default async function CaseOverviewPage(
  props: PageProps<"/cases/[id]">,
) {
  const { id } = await props.params;
  const record = await getCaseDetail(id);
  if (!record) notFound();
  // getCaseDetail has already enforced case access.
  const conflictCheck = await getLatestConflictCheck(id);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {" "}
      <section className="card p-6 lg:col-span-2">
        {" "}
        <h2 className="mb-5 text-sm font-semibold text-primary">
          Matter details
        </h2>
        <dl className="grid gap-5 sm:grid-cols-2">
          {" "}
          <Detail label="Case number" value={record.caseNumber} />{" "}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              Client
            </dt>
            <dd className="mt-1 text-sm text-primary">
              {record.clientId ? (
                <Link
                  href={`/clients/${record.clientId}`}
                  className="underline-offset-2 hover:underline"
                >
                  {record.clientName}
                </Link>
              ) : (
                record.clientName
              )}
            </dd>
          </div>{" "}
          <Detail label="Court" value={record.court} />{" "}
          <Detail label="Jurisdiction" value={record.jurisdiction} />{" "}
          <Detail label="Judge" value={record.judge} />{" "}
          <Detail label="Filed on" value={formatDate(record.filedOn)} />{" "}
          <Detail label="Opposing party" value={record.opposingParty} />{" "}
          <Detail label="Opposing counsel" value={record.opposingCounsel} />
        </dl>
        <div className="mt-6 border-t border-hairline pt-5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
            Conflict of interest check
          </h3>
          {!conflictCheck ? (
            <p className="mt-1 text-sm text-secondary">
              No check on record — this matter predates conflict checking. Editing its
              parties will run one.
            </p>
          ) : conflictCheck.outcome === "CLEAR" ? (
            <p className="mt-1 text-sm text-primary">
              <span className="font-medium text-success">Cleared</span> by{" "}
              {conflictCheck.performedBy.name} on {formatDate(conflictCheck.createdAt)}
              {conflictCheck.relatedMatches > 0
                ? ` · ${conflictCheck.relatedMatches} related matter${conflictCheck.relatedMatches === 1 ? "" : "s"}`
                : ""}
            </p>
          ) : (
            <div className="mt-1 text-sm text-primary">
              <p>
                <span className="font-medium text-danger">
                  Proceeded despite {conflictCheck.adverseMatches} possible conflict
                  {conflictCheck.adverseMatches === 1 ? "" : "s"}
                </span>{" "}
                — recorded by {conflictCheck.performedBy.name} on{" "}
                {formatDate(conflictCheck.createdAt)}
              </p>
              {conflictCheck.waiverReason ? (
                <blockquote className="mt-2 border-l-2 border-hairline pl-3 text-secondary">
                  {conflictCheck.waiverReason}
                </blockquote>
              ) : null}
            </div>
          )}
        </div>
      </section>
      <section className="card h-fit p-6">
        {" "}
        <h2 className="mb-4 text-sm font-semibold text-primary">
          Assigned team
        </h2>
        {record.assignments.length === 0 ? (
          <p className="text-sm text-muted">
            Nobody is assigned to this case yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {record.assignments.map((entry) => (
              <li key={entry.user.id} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-sunken text-[11px] font-semibold text-secondary"
                >
                  {entry.user.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? "")
                    .join("")}
                </span>
                <span className="min-w-0">
                  {" "}
                  <span className="block truncate text-sm text-primary">
                    {entry.user.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {CASE_ROLE_LABELS[entry.roleOnCase]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <hr className="my-5 border-hairline" />{" "}
        <dl className="space-y-3">
          {" "}
          <div className="flex justify-between text-sm">
            {" "}
            <dt className="text-secondary">Documents</dt>{" "}
            <dd className="text-primary">{record._count.documents}</dd>
          </div>
          <div className="flex justify-between text-sm">
            {" "}
            <dt className="text-secondary">Hearings</dt>{" "}
            <dd className="text-primary">{record._count.hearings}</dd>
          </div>
          <div className="flex justify-between text-sm">
            {" "}
            <dt className="text-secondary">Tasks</dt>{" "}
            <dd className="text-primary">{record._count.tasks}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
