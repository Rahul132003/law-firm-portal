import Link from "next/link";
import type { CaseSummary } from "@/lib/cases/queries";
import { StatusBadge, TypeBadge } from "./status-badge";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

/** Up to three names, then "+N". Keeps the row height fixed. */
function TeamCell({
  assignments,
}: {
  assignments: CaseSummary["assignments"];
}) {
  if (assignments.length === 0) {
    return <span className="text-muted">Unassigned</span>;
  }

  const shown = assignments.slice(0, 3);
  const overflow = assignments.length - shown.length;

  return (
    <span className="font-semibold text-secondary">
      {shown.map((entry) => entry.user.name).join(", ")}
      {overflow > 0 ? <span className="text-muted"> +{overflow}</span> : null}
    </span>
  );
}

export function CaseTable({ cases }: { cases: CaseSummary[] }) {
  return (
    // Wide table scrolls inside its own container rather than the page body.
    <div className="card overflow-x-auto border border-hairline bg-white shadow-sm">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-left bg-sunken/80">
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-secondary">
              Case
            </th>
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-secondary">
              Client
            </th>
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-secondary">
              Court
            </th>
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-secondary">
              Team
            </th>
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-secondary">
              Filed
            </th>
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-secondary">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {cases.map((record) => (
            <tr
              key={record.id}
              className="border-b border-hairline last:border-0 hover:bg-sunken/70 transition-colors duration-150"
            >
              <td className="px-4 py-3.5">
                <Link
                  href={`/cases/${record.id}`}
                  className="font-bold text-base text-primary hover:text-accent-700 transition-colors"
                >
                  {record.title}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-muted">
                    {record.caseNumber}
                  </span>
                  <TypeBadge caseType={record.caseType} />
                </div>
              </td>
              <td className="px-4 py-3.5 font-bold text-primary">{record.clientName}</td>
              <td className="px-4 py-3.5">
                <span className="font-bold text-primary">{record.court}</span>
                <div className="text-xs font-medium text-muted">{record.jurisdiction}</div>
              </td>
              <td className="px-4 py-3.5">
                <TeamCell assignments={record.assignments} />
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-secondary">
                {formatDate(record.filedOn)}
              </td>
              <td className="px-4 py-3.5">
                <StatusBadge status={record.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
