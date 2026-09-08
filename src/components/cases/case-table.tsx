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
    <span className="font-semibold text-slate-700">
      {shown.map((entry) => entry.user.name).join(", ")}
      {overflow > 0 ? <span className="text-slate-500"> +{overflow}</span> : null}
    </span>
  );
}

export function CaseTable({ cases }: { cases: CaseSummary[] }) {
  return (
    // Wide table scrolls inside its own container rather than the page body.
    <div className="card overflow-x-auto border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left bg-slate-50/80">
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-slate-600">
              Case
            </th>
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-slate-600">
              Client
            </th>
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-slate-600">
              Court
            </th>
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-slate-600">
              Team
            </th>
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-slate-600">
              Filed
            </th>
            <th scope="col" className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-slate-600">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {cases.map((record) => (
            <tr
              key={record.id}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors duration-150"
            >
              <td className="px-4 py-3.5">
                <Link
                  href={`/cases/${record.id}`}
                  className="font-bold text-base text-slate-900 hover:text-sky-700 transition-colors"
                >
                  {record.title}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    {record.caseNumber}
                  </span>
                  <TypeBadge caseType={record.caseType} />
                </div>
              </td>
              <td className="px-4 py-3.5 font-bold text-slate-800">{record.clientName}</td>
              <td className="px-4 py-3.5">
                <span className="font-bold text-slate-800">{record.court}</span>
                <div className="text-xs font-medium text-slate-500">{record.jurisdiction}</div>
              </td>
              <td className="px-4 py-3.5">
                <TeamCell assignments={record.assignments} />
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-slate-700">
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
