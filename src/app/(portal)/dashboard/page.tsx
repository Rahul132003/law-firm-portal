import type { Metadata } from "next";
import Link from "next/link";

import { ROLE_LABELS, canViewReports, isAdmin } from "@/lib/auth/roles";
import { requireUser } from "@/lib/dal";
import {
  getDashboardData,
  getOversightData,
} from "@/lib/dashboard/queries";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/documents/constants";
import { FIRM_NAME } from "@/lib/firm";
import { TASK_KIND_LABELS, isDeadline } from "@/lib/tasks/constants";
import { serverNow } from "@/lib/time";
import { CasesByStatusChart } from "@/components/reports/charts";

export const metadata: Metadata = {
  title: `Dashboard · ${FIRM_NAME}`,
};

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function daysBetween(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

function relativeDay(date: Date, now: Date): string {
  const days = daysBetween(date, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `In ${days} days`;
  return shortFmt.format(date);
}

function Stat({
  label,
  value,
  href,
  urgent = false,
  icon,
  iconBg,
}: {
  label: string;
  value: number;
  href: string;
  urgent?: boolean;
  icon: string;
  iconBg: string;
}) {
  return (
    <Link
      href={href}
      className="card card-interactive px-5 py-5 flex items-start justify-between border border-slate-200/90 bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-2xl"
    >
      <div className="flex flex-col">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span
          className={`mt-2 block text-4xl font-black tracking-tight ${
            urgent && value > 0 ? "text-rose-600" : "text-slate-900"
          }`}
        >
          {value}
        </span>
        <span className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-emerald-500">
            <path d="M6 2.5L9.5 6.5H2.5L6 2.5Z" fill="currentColor" />
          </svg>
          This month
        </span>
      </div>
      <span className={`grid size-11 place-items-center rounded-2xl text-xl shadow-sm ${iconBg}`}>
        {icon}
      </span>
    </Link>
  );
}

function Card({
  title,
  action,
  icon,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6 md:p-7 border border-slate-200/90 bg-white shadow-sm rounded-2xl">
      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-lg">
              {icon}
            </span>
          )}
          <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
        </div>
        {action ? (
          <Link
            href={action.href}
            className="shrink-0 flex items-center gap-1 text-sm font-bold text-sky-700 hover:text-sky-800 transition-colors"
          >
            {action.label}
            <span className="text-xs">↗</span>
          </Link>
        ) : null}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const now = serverNow();

  const [data, oversight] = await Promise.all([
    getDashboardData(user, now),
    getOversightData(user, now),
  ]);

  const firstName = user.name.split(" ")[0];
  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* ═══ Hero Welcome Banner (teal gradient, matching reference portal) ═══ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-800 via-teal-700 to-teal-600 px-8 py-8 md:px-10 md:py-10 mb-7 shadow-lg">
        {/* Decorative background dots/pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* Decorative circles */}
        <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-teal-500/30 blur-2xl" />
        <div className="absolute right-20 bottom-0 h-32 w-32 translate-y-10 rounded-full bg-emerald-400/20 blur-2xl" />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3.5 py-1.5 text-xs font-bold text-white border border-white/20">
            📅 {dateFmt.format(now).toUpperCase()}
          </span>

          <h1 className="mt-4 text-3xl md:text-4xl font-black text-white leading-tight">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-2 max-w-xl text-base font-medium text-teal-100/90 leading-relaxed">
            Overview of today&apos;s legal cases, upcoming hearings, and team activity across all managed matters.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-4 py-1.5 text-xs font-black text-white shadow-sm">
              🏛️ {ROLE_LABELS[user.role].toUpperCase()}
            </span>
            {oversight ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-4 py-1.5 text-xs font-bold text-white">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                {oversight.isFirmWide
                  ? `${oversight.openCases} ACTIVE MATTERS`
                  : `${oversight.openCases} TEAM MATTERS`}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ═══ Stat Cards Row ═══ */}
      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat
          label="Total Cases"
          value={data.myCases}
          href="/cases"
          icon="📁"
          iconBg="bg-sky-100 text-sky-600"
        />
        <Stat
          label="Open Tasks"
          value={data.myOpenTasks}
          href="/tasks"
          icon="📋"
          iconBg="bg-amber-100 text-amber-600"
        />
        <Stat
          label="Completed"
          value={data.casesByStatus.find((s) => s.label === "Closed")?.count ?? 0}
          href="/cases?status=CLOSED"
          icon="✅"
          iconBg="bg-rose-100 text-rose-600"
        />
        <Stat
          label="Hearings Soon"
          value={data.hearingsSoon}
          href="/diary"
          icon="⏰"
          iconBg="bg-emerald-100 text-emerald-600"
        />
        <Stat
          label="Overdue"
          value={data.myOverdue}
          href="/tasks?due=overdue"
          urgent
          icon="📅"
          iconBg="bg-purple-100 text-purple-600"
        />
      </div>

      {/* ═══ Two-column bottom layout ═══ */}
      <div className="grid gap-7 lg:grid-cols-2">
        {/* Left: Hearings + Tasks */}
        <div className="space-y-7">
          <Card
            title="Next Hearings"
            action={{ href: "/diary", label: "Court diary" }}
            icon="📆"
          >
            {data.upcomingHearings.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="text-4xl mb-3">📭</span>
                <p className="text-base font-bold text-slate-500">Nothing scheduled.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.upcomingHearings.map((hearing) => {
                  const imminent = daysBetween(hearing.date, now) <= 1;
                  return (
                    <li key={hearing.id}>
                      <Link
                        href={`/cases/${hearing.caseId}/hearings`}
                        className={`block rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                          imminent
                            ? "border-amber-300 bg-amber-50/80"
                            : "border-slate-200 bg-slate-50/70 hover:bg-white"
                        }`}
                      >
                        <span
                          className={`block text-xs font-black uppercase tracking-wider ${
                            imminent ? "text-amber-800" : "text-slate-500"
                          }`}
                        >
                          {relativeDay(hearing.date, now)}
                        </span>
                        <span className="mt-1 block truncate text-base font-extrabold text-slate-900">
                          {hearing.case.title}
                        </span>
                        <span className="block truncate text-sm font-bold text-slate-700 mt-0.5">
                          {timeFmt.format(hearing.date)} · {hearing.court}
                        </span>
                        <span className="mt-1 block truncate text-sm text-slate-600 font-medium">
                          {hearing.purpose}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Your Tasks" action={{ href: "/tasks", label: "All tasks" }} icon="✏️">
            {data.myTasks.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="text-4xl mb-3">🎉</span>
                <p className="text-base font-bold text-slate-500">Nothing outstanding.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.myTasks.map((task) => {
                  const overdue = task.dueDate.getTime() < now.getTime();
                  return (
                    <li
                      key={task.id}
                      className="border-b border-slate-100 pb-3.5 last:border-0 last:pb-0"
                    >
                      <p className="text-base font-extrabold text-slate-900">{task.description}</p>
                      <p className="mt-1 text-sm font-semibold">
                        <span
                          className={
                            overdue
                              ? "font-black text-rose-600"
                              : "font-extrabold text-sky-700"
                          }
                        >
                          {overdue ? "Overdue" : "Due"}{" "}
                          {shortFmt.format(task.dueDate)}
                        </span>
                        {isDeadline(task.kind) ? (
                          <span className="text-slate-600 font-medium">
                            {" · "}
                            {TASK_KIND_LABELS[task.kind]}
                          </span>
                        ) : null}
                        {task.case ? (
                          <span className="text-slate-600 font-medium">
                            {" · "}
                            {task.case.caseNumber}
                          </span>
                        ) : null}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Right: Recent Reports + Overview */}
        <div className="space-y-7">
          <Card
            title="Recent Reports"
            action={{ href: "/documents", label: "View all" }}
            icon="📄"
          >
            {data.recentDocuments.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="text-4xl mb-3">📭</span>
                <p className="text-base font-bold text-slate-500">Nothing filed yet.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.recentDocuments.map((doc) => (
                  <li
                    key={doc.id}
                    className="border-b border-slate-100 pb-3.5 last:border-0 last:pb-0"
                  >
                    <Link
                      href={`/cases/${doc.caseId}/documents`}
                      className="block hover:bg-slate-50 rounded-xl p-2 -m-2 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-extrabold text-slate-900">
                            {doc.uploadedBy.name}
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-slate-600 line-clamp-2">
                            {doc.title}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-slate-400 whitespace-nowrap">
                          {shortFmt.format(doc.uploadedAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Cases Overview" action={{ href: "/cases", label: "View all" }} icon="📊">
            <CasesByStatusChart data={data.casesByStatus} />
          </Card>

          {oversight ? (
            <Card
              title={oversight.isFirmWide ? "Firm Overview" : "Your Team"}
              action={{ href: "/reports", label: "Full reports" }}
              icon="🏢"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <span className="block text-3xl font-black text-slate-900">
                    {oversight.openCases}
                  </span>
                  <span className="text-sm font-bold text-slate-600">Open matters</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <span className="block text-3xl font-black text-slate-900">
                    {oversight.hearingsThisWeek}
                  </span>
                  <span className="text-sm font-bold text-slate-600">Hearings this week</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <span
                    className={`block text-3xl font-black ${
                      oversight.overdueAcrossScope > 0
                        ? "text-rose-600"
                        : "text-slate-900"
                    }`}
                  >
                    {oversight.overdueAcrossScope}
                  </span>
                  <span className="text-sm font-bold text-slate-600">
                    {oversight.isFirmWide ? "Overdue (firm)" : "Overdue (team)"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <span
                    className={`block text-3xl font-black ${
                      oversight.unassignedCases > 0
                        ? "text-amber-700"
                        : "text-slate-900"
                    }`}
                  >
                    {oversight.unassignedCases}
                  </span>
                  <span className="text-sm font-bold text-slate-600">Unassigned</span>
                </div>
              </div>

              {oversight.unassignedCases > 0 ? (
                <p className="mt-5 text-sm font-bold text-amber-900 bg-amber-50 rounded-2xl p-4 border border-amber-200">
                  Unassigned matters are invisible to everyone except partners —
                  worth assigning someone.
                </p>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>

      {/* ═══ Quick links ═══ */}
      <nav className="mt-7 flex flex-wrap gap-3" aria-label="Quick links">
        {[
          { href: "/cases", label: "Cases" },
          { href: "/documents", label: "Documents" },
          { href: "/diary", label: "Court diary" },
          { href: "/tasks", label: "Tasks" },
          { href: "/notices", label: "Notice board" },
          ...(canViewReports(user.role)
            ? [{ href: "/reports", label: "Reports" }]
            : []),
          ...(isAdmin(user.role)
            ? [{ href: "/admin", label: "Administration" }]
            : []),
          { href: "/settings", label: "Your account" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:border-sky-400/50 hover:bg-sky-50 hover:text-sky-700 transition-all shadow-sm"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
