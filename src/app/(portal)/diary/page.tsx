import type { Metadata } from "next";
import Link from "next/link";

import {
  HearingCalendar,
  type CalendarHearing,
} from "@/components/hearings/hearing-calendar";
import {
  listHearingsInRange,
  listUpcomingHearings,
} from "@/lib/hearings/queries";
import { requireUser } from "@/lib/dal";
import { serverNow } from "@/lib/time";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `Court Diary · ${FIRM_NAME}`,
};

function first(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single && single.trim() !== "" ? single : undefined;
}

function relativeDay(date: Date, now: Date): string {
  const days = Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `In ${days} days`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export default async function DiaryPage(props: PageProps<"/diary">) {
  const searchParams = await props.searchParams;
  const user = await requireUser();

  const now = serverNow();
  const yearParam = Number(first(searchParams, "year"));
  const monthParam = Number(first(searchParams, "month"));

  // Fall back to the current month for absent or nonsensical parameters.
  const year =
    Number.isInteger(yearParam) && yearParam >= 1970 && yearParam <= 2200
      ? yearParam
      : now.getFullYear();
  const month =
    Number.isInteger(monthParam) && monthParam >= 0 && monthParam <= 11
      ? monthParam
      : now.getMonth();

  const monthStart = new Date(year, month, 1, 0, 0, 0);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

  const [monthHearings, upcoming] = await Promise.all([
    listHearingsInRange(user, monthStart, monthEnd),
    listUpcomingHearings(user, 8),
  ]);

  // Rich data mapping — include client, notes, status for the new calendar
  const calendarHearings: CalendarHearing[] = monthHearings.map((hearing) => ({
    id: hearing.id,
    date: hearing.date,
    court: hearing.court,
    purpose: hearing.purpose,
    notes: hearing.notes || null,
    nextDate: hearing.nextDate || null,
    caseId: hearing.caseId,
    caseNumber: hearing.case.caseNumber,
    caseTitle: hearing.case.title,
    clientName: hearing.case.clientName || null,
    caseStatus: hearing.case.status || null,
  }));

  // Stats calculations
  const totalMonth = monthHearings.length;
  const todayHearings = monthHearings.filter((h) => {
    const d = new Date(h.date);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }).length;

  const distinctCourts = new Set(monthHearings.map((h) => h.court)).size;

  const sevenDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 7,
  );
  const next7Days = monthHearings.filter((h) => {
    const d = new Date(h.date);
    return d >= now && d <= sevenDaysFromNow;
  }).length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Page Header ── */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          Court Diary
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Hearings across every matter you have access to.
        </p>
      </header>

      {/* ── Stats Overview Banner ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Month Hearings"
          value={totalMonth}
          icon="📅"
          accentBg="bg-sky-100"
          accentText="text-sky-600"
        />
        <StatCard
          label="Today"
          value={todayHearings}
          icon="🔔"
          accentBg="bg-amber-100"
          accentText="text-amber-600"
          pulse={todayHearings > 0}
        />
        <StatCard
          label="Active Courts"
          value={distinctCourts}
          icon="🏛️"
          accentBg="bg-indigo-100"
          accentText="text-indigo-600"
        />
        <StatCard
          label="Next 7 Days"
          value={next7Days}
          icon="⏳"
          accentBg="bg-emerald-100"
          accentText="text-emerald-600"
        />
      </div>

      {/* ── Main Content: Calendar + Sidebar ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <HearingCalendar
          year={year}
          month={month}
          hearings={calendarHearings}
        />

        {/* ── Upcoming Sidebar ── */}
        <aside className="card h-fit overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">Next Up</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Reminders go out 7, 3 and 1 days ahead.
            </p>
          </div>

          <div className="p-4">
            {upcoming.length === 0 ? (
              <div className="py-6 text-center">
                <span className="mb-2 block text-3xl">📭</span>
                <p className="text-sm font-bold text-slate-600">
                  No upcoming hearings
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Your diary is clear for now.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((hearing) => {
                  const rel = relativeDay(hearing.date, now);
                  const isToday = rel === "Today";

                  return (
                    <li key={hearing.id}>
                      <Link
                        href={`/cases/${hearing.caseId}/hearings`}
                        className="group block rounded-xl border border-slate-200 bg-white p-3 shadow-2xs transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                              isToday
                                ? "bg-amber-100 text-amber-700"
                                : "bg-sky-100 text-sky-700"
                            }`}
                          >
                            {isToday && (
                              <span className="relative flex size-1.5">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75" />
                                <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                              </span>
                            )}
                            {rel}
                          </span>

                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                            {new Intl.DateTimeFormat("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(hearing.date)}
                          </span>
                        </div>

                        <span className="block truncate text-sm font-bold text-slate-900 transition group-hover:text-sky-600">
                          {hearing.case.title}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-slate-500">
                          {hearing.case.caseNumber}
                        </span>

                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="truncate text-xs text-slate-600">
                            {hearing.purpose}
                          </span>
                          <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                            🏛️{" "}
                            <span className="max-w-20 truncate">
                              {hearing.court}
                            </span>
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Stats Card ── */
function StatCard({
  label,
  value,
  icon,
  accentBg,
  accentText,
  pulse,
}: {
  label: string;
  value: number;
  icon: string;
  accentBg: string;
  accentText: string;
  pulse?: boolean;
}) {
  return (
    <div className="card flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div
        className={`flex size-10 items-center justify-center rounded-xl text-lg ${accentBg} ${accentText} ${
          pulse ? "animate-pulse" : ""
        }`}
      >
        {icon}
      </div>
      <div>
        <span className="block text-xl font-black text-slate-900">{value}</span>
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
}
