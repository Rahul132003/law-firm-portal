import type { Metadata } from "next";
import Link from "next/link";

import {
  CaseIntakeChart,
  CasesByStatusChart,
  CasesPerAdvocateChart,
} from "@/components/reports/charts";
import {
  ExportPdfButton,
  type ReportPayload,
} from "@/components/reports/export-pdf";
import { ROLE_LABELS, canViewReports, isAdmin } from "@/lib/auth/roles";
import { CASE_STATUS_LABELS, CASE_STATUS_ORDER } from "@/lib/cases/labels";
import { requireCapability } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import {
  getCaseIntakeTrend,
  getCasesByStatus,
  getCasesPerAdvocate,
  getFirmSummary,
  getHearingsThisWeek,
  getOverdueTasks,
} from "@/lib/reports/queries";
import { TASK_KIND_LABELS } from "@/lib/tasks/constants";
import { serverNow } from "@/lib/time";

export const metadata: Metadata = {
  title: `Reports · ${FIRM_NAME}`,
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="card px-5 py-4 border border-slate-200/90 bg-white shadow-sm">
      <span
        className={`block text-3xl font-extrabold ${tone ?? "text-amber-700"}`}
      >
        {value}
      </span>
      <span className="mt-1 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
        {label}
      </span>
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6 border border-slate-200/90 bg-white shadow-sm">
      <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs font-semibold text-slate-500">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function ReportsPage() {
  // Partners and senior advocates only; throws 403 otherwise.
  const user = await requireCapability(canViewReports);
  const now = serverNow();
  const scope = { user, now };

  const [summary, perAdvocate, byStatus, intake, hearings, overdue] =
    await Promise.all([
      getFirmSummary(scope),
      getCasesPerAdvocate(scope),
      getCasesByStatus(scope),
      getCaseIntakeTrend(scope),
      getHearingsThisWeek(scope),
      getOverdueTasks(scope),
    ]);

  const scopeNote = isAdmin(user.role)
    ? "Scope: all matters across the firm."
    : "Scope: your matters and those of your direct reports.";

  const statusCounts = new Map(byStatus.map((row) => [row.status, row.count]));
  const statusData = CASE_STATUS_ORDER.map((status) => ({
    label: CASE_STATUS_LABELS[status],
    count: statusCounts.get(status) ?? 0,
  }));

  const advocateData = perAdvocate.map((row) => ({
    name: row.name,
    open: row.open,
  }));

  const payload: ReportPayload = {
    firmName: FIRM_NAME,
    generatedBy: `${user.name} (${ROLE_LABELS[user.role]})`,
    generatedAt: dateTimeFmt.format(now),
    scopeNote,
    summary: [
      { label: "Total cases", value: String(summary.totalCases) },
      { label: "Open cases", value: String(summary.openCases) },
      { label: "Closed cases", value: String(summary.closedCases) },
      { label: "Hearings in the next 7 days", value: String(summary.hearingsThisWeek) },
      { label: "Overdue tasks", value: String(summary.overdueTasks) },
      { label: "Documents on file", value: String(summary.documentCount) },
      { label: "Active staff", value: String(summary.activeStaff) },
    ],
    casesPerAdvocate: perAdvocate.map((row) => [
      row.name,
      ROLE_LABELS[row.role],
      String(row.open),
      String(row.total),
    ]),
    hearingsThisWeek: hearings.map((h) => [
      dateTimeFmt.format(h.date),
      h.case.caseNumber,
      h.court,
      h.purpose,
    ]),
    overdueTasks: overdue.map((t) => [
      dateFmt.format(t.dueDate),
      t.description.slice(0, 70),
      t.assignedTo.name,
      t.case?.caseNumber ?? "Personal",
    ]),
  };

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Reports & Analytics
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">{scopeNote}</p>
        </div>
        <ExportPdfButton payload={payload} />
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Open cases" value={summary.openCases} />
        <Tile label="Hearings this week" value={summary.hearingsThisWeek} />
        <Tile
          label="Overdue tasks"
          value={summary.overdueTasks}
          tone={summary.overdueTasks > 0 ? "text-rose-600 font-extrabold" : undefined}
        />
        <Tile label="Documents on file" value={summary.documentCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Cases per advocate"
          hint="Open matters currently assigned. Closed matters excluded."
        >
          <CasesPerAdvocateChart data={advocateData} />
        </Panel>

        <Panel
          title="Case status"
          hint="Distribution across the lifecycle, Filed through Closed."
        >
          <CasesByStatusChart data={statusData} />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="New matters intake" hint="Cases opened per month over the last 12 months.">
          <CaseIntakeChart data={intake} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Hearings this week">
          {hearings.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-slate-500">
              Nothing listed in the next seven days.
            </p>
          ) : (
            <ul className="space-y-3">
              {hearings.map((hearing) => (
                <li
                  key={hearing.id}
                  className="border-b border-slate-100 pb-2.5 last:border-0 last:pb-0"
                >
                  <Link
                    href={`/cases/${hearing.caseId}/hearings`}
                    className="text-sm font-bold text-slate-900 hover:text-amber-700 transition-colors"
                  >
                    {hearing.case.title}
                  </Link>
                  <p className="mt-0.5 text-xs font-bold text-amber-700">
                    {dateTimeFmt.format(hearing.date)} · {hearing.court}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    {hearing.case.caseNumber} · {hearing.purpose}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Overdue tasks">
          {overdue.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-slate-500">
              Nothing overdue.
            </p>
          ) : (
            <ul className="space-y-3">
              {overdue.slice(0, 12).map((task) => (
                <li
                  key={task.id}
                  className="border-b border-slate-100 pb-2.5 last:border-0 last:pb-0"
                >
                  <p className="text-sm font-bold text-slate-900">{task.description}</p>
                  <p className="mt-0.5 text-xs font-extrabold text-rose-600">
                    Due {dateFmt.format(task.dueDate)} ·{" "}
                    {TASK_KIND_LABELS[task.kind]}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    {task.assignedTo.name} ·{" "}
                    {task.case?.caseNumber ?? "Personal task"}
                  </p>
                </li>
              ))}
              {overdue.length > 12 ? (
                <li className="pt-1 text-xs font-medium text-slate-500">
                  and {overdue.length - 12} more — see the PDF export.
                </li>
              ) : null}
            </ul>
          )}
        </Panel>
      </div>

      {/* A table view of the chart data, so identity is never colour-alone. */}
      <details className="mt-6">
        <summary className="cursor-pointer text-xs font-bold text-slate-600 hover:text-amber-700 transition-colors">
          View chart data as a table
        </summary>
        <div className="card mt-3 overflow-x-auto p-4 border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">
              Open and total cases per advocate
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th scope="col" className="px-3 py-2.5 font-extrabold uppercase tracking-wider text-xs text-slate-500">
                  Advocate
                </th>
                <th scope="col" className="px-3 py-2.5 font-extrabold uppercase tracking-wider text-xs text-slate-500">
                  Role
                </th>
                <th scope="col" className="px-3 py-2.5 font-extrabold uppercase tracking-wider text-xs text-slate-500">
                  Open
                </th>
                <th scope="col" className="px-3 py-2.5 font-extrabold uppercase tracking-wider text-xs text-slate-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {perAdvocate.map((row) => (
                <tr key={row.userId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 font-bold text-slate-900">{row.name}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-600">
                    {ROLE_LABELS[row.role]}
                  </td>
                  <td className="px-3 py-2.5 font-extrabold text-amber-700">{row.open}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-800">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
