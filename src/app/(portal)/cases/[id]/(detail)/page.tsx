import { notFound } from "next/navigation";
import { CASE_ROLE_LABELS } from "@/lib/cases/labels";
import { getCaseDetail } from "@/lib/cases/queries";

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
          <Detail label="Client" value={record.clientName} />{" "}
          <Detail label="Court" value={record.court} />{" "}
          <Detail label="Jurisdiction" value={record.jurisdiction} />{" "}
          <Detail label="Judge" value={record.judge} />{" "}
          <Detail label="Filed on" value={formatDate(record.filedOn)} />{" "}
          <Detail label="Opposing party" value={record.opposingParty} />{" "}
          <Detail label="Opposing counsel" value={record.opposingCounsel} />
        </dl>
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
