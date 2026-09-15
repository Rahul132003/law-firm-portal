import type { Metadata } from "next";
import Link from "next/link";

import { EntryList, type DayGroup } from "@/components/time/entry-list";
import { TimeEntryForm } from "@/components/time/time-entry-form";
import { TimerWidget } from "@/components/time/timer-widget";
import { EmptyState } from "@/components/ui/empty-state";
import { canReadAllCases, canReadTeamCases, isAdmin } from "@/lib/auth/roles";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { getAssignableCases } from "@/lib/tasks/queries";
import {
  canViewTimesheetOf,
  firmToday,
  getRunningTimer,
  getTeamWeek,
  getTimesheetPeople,
  listWeekEntries,
} from "@/lib/time-tracking/queries";
import {
  addDays,
  formatMinutes,
  parseDay,
  startOfWeek,
  toDayString,
  toHours,
  weekDays,
} from "@/lib/time-tracking/rules";
import { serverNowMs } from "@/lib/time";

export const metadata: Metadata = {
  title: `Time · ${FIRM_NAME}`,
};

const dayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const shortDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
const rangeLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function pick(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() || undefined;
}

export default async function TimePage(props: PageProps<"/time">) {
  const user = await requireUser();
  const params = await props.searchParams;

  const today = firmToday();
  const monday = startOfWeek(parseDay(pick(params.week) ?? "") ?? today);
  const days = weekDays(monday);
  const isManager = canReadAllCases(user.role) || canReadTeamCases(user.role);
  const view = isManager && pick(params.view) === "team" ? "team" : "person";

  const requestedPerson = pick(params.person) ?? user.id;
  const personId = (await canViewTimesheetOf(user, requestedPerson)) ? requestedPerson : user.id;
  const isSelf = personId === user.id;

  const query = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = {
      week: toDayString(monday) === toDayString(startOfWeek(today)) ? undefined : toDayString(monday),
      view: view === "team" ? "team" : undefined,
      person: isSelf ? undefined : personId,
      ...overrides,
    };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    const s = search.toString();
    return s ? `/time?${s}` : "/time";
  };

  const tab = (active: boolean) =>
    `border-b-2 px-3 py-2 text-sm ${active ? "border-accent-600 font-medium text-primary" : "border-transparent text-secondary hover:text-primary"}`;

  const [cases, people, timer] = await Promise.all([
    getAssignableCases(user),
    isManager ? getTimesheetPeople(user) : Promise.resolve([]),
    getRunningTimer(user.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Time</h1>
        <p className="mt-1 text-sm text-secondary">Record the time spent on matters and firm work.</p>
      </header>

      <div className="mb-6">
        <TimerWidget
          nowMs={serverNowMs()}
          cases={cases}
          timer={
            timer
              ? {
                  startedAtMs: timer.startedAt.getTime(),
                  caseLabel: timer.case ? `${timer.case.caseNumber} — ${timer.case.title}` : null,
                  activity: timer.activity,
                  description: timer.description,
                }
              : null
          }
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-hairline">
        <nav className="-mb-px flex" aria-label="Time views">
          <Link href={query({ view: undefined })} className={tab(view === "person")}>
            {isSelf ? "My timesheet" : "Timesheet"}
          </Link>
          {isManager ? (
            <Link href={query({ view: "team", person: undefined })} className={tab(view === "team")}>
              Team
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-2 pb-2 text-sm">
          <Link href={query({ week: toDayString(addDays(monday, -7)) })} className="rounded-md border border-hairline px-2 py-1 text-secondary hover:bg-sunken" aria-label="Previous week">←</Link>
          <span className="min-w-44 text-center text-primary">
            {rangeLabel.format(monday)} – {rangeLabel.format(addDays(monday, 6))}
          </span>
          <Link href={query({ week: toDayString(addDays(monday, 7)) })} className="rounded-md border border-hairline px-2 py-1 text-secondary hover:bg-sunken" aria-label="Next week">→</Link>
          <Link href={query({ week: undefined })} className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken">This week</Link>
        </div>
      </div>

      {view === "team" ? (
        <TeamWeek user={user} monday={monday} days={days} weekParam={toDayString(monday)} />
      ) : (
        <PersonWeek
          personId={personId}
          isSelf={isSelf}
          canDelete={isSelf || isAdmin(user.role)}
          people={people}
          monday={monday}
          days={days}
          today={today}
          cases={cases}
          personHref={(id) => query({ person: id === user.id ? undefined : id })}
        />
      )}
    </div>
  );
}

async function PersonWeek({
  personId,
  isSelf,
  canDelete,
  people,
  monday,
  days,
  today,
  cases,
  personHref,
}: {
  personId: string;
  isSelf: boolean;
  canDelete: boolean;
  people: Array<{ id: string; name: string }>;
  monday: Date;
  days: Date[];
  today: Date;
  cases: Array<{ id: string; caseNumber: string; title: string }>;
  personHref: (id: string) => string;
}) {
  const entries = await listWeekEntries(personId, monday);
  const total = entries.reduce((sum, e) => sum + e.minutes, 0);

  const perDay = days.map((day) => ({
    day,
    minutes: entries
      .filter((e) => e.workDate.getTime() === day.getTime())
      .reduce((sum, e) => sum + e.minutes, 0),
  }));

  const groups: DayGroup[] = days
    .slice()
    .reverse()
    .map((day) => ({
      day: toDayString(day),
      label: dayLabel.format(day),
      entries: entries
        .filter((e) => e.workDate.getTime() === day.getTime())
        .map((e) => ({ ...e, workDate: toDayString(e.workDate) })),
    }))
    .filter((group) => group.entries.length > 0);

  const todayString = toDayString(today);
  // Today when viewing the current week, the week's Sunday for a past week.
  const sunday = addDays(monday, 6);
  const defaultDate = toDayString(sunday < today ? sunday : today);

  return (
    <div className="space-y-6">
      {people.length > 1 ? (
        <nav aria-label="Choose person" className="flex flex-wrap gap-2">
          {people.map((person) => (
            <Link
              key={person.id}
              href={personHref(person.id)}
              className={`rounded-full border px-3 py-1 text-xs ${person.id === personId ? "border-accent-700 bg-accent-700 text-white" : "border-hairline text-secondary hover:bg-sunken"}`}
            >
              {person.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {perDay.map(({ day, minutes }) => (
          <div
            key={day.toISOString()}
            className={`rounded-lg border px-2 py-2 text-center ${toDayString(day) === todayString ? "border-accent-600" : "border-hairline"}`}
          >
            <div className="text-[11px] text-muted">{shortDay.format(day)}</div>
            <div className={`font-mono text-sm tabular-nums ${minutes ? "text-primary" : "text-muted"}`}>{formatMinutes(minutes)}</div>
          </div>
        ))}
        <div className="col-span-4 rounded-lg bg-sunken px-2 py-2 text-center sm:col-span-1">
          <div className="text-[11px] text-muted">Week</div>
          <div className="font-mono text-sm font-semibold tabular-nums text-primary">{toHours(total)}h</div>
        </div>
      </div>

      {isSelf ? (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-primary">Add time</h2>
          <TimeEntryForm
            // Remount per week so the default date follows the week in view.
            key={defaultDate}
            cases={cases}
            maxDate={todayString}
            defaults={{ caseId: "", workDate: defaultDate, duration: "", activity: "DRAFTING", description: "" }}
          />
        </section>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          title="No time recorded this week"
          description={isSelf ? "Add an entry above or start the timer." : "Nothing has been recorded for this week."}
        />
      ) : (
        <EntryList groups={groups} cases={cases} maxDate={todayString} canEdit={isSelf} canDelete={canDelete} />
      )}
    </div>
  );
}

async function TeamWeek({
  user,
  monday,
  days,
  weekParam,
}: {
  user: Awaited<ReturnType<typeof requireUser>>;
  monday: Date;
  days: Date[];
  weekParam: string;
}) {
  const rows = await getTeamWeek(user, monday);
  const dayTotals = days.map((day) =>
    rows.reduce((sum, row) => sum + (row.byDay.get(toDayString(day)) ?? 0), 0),
  );
  const grand = dayTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline bg-sunken/80 text-left">
            <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-secondary">Person</th>
            {days.map((day) => (
              <th key={day.toISOString()} scope="col" className="px-2 py-2.5 text-right text-xs font-semibold text-secondary">{shortDay.format(day)}</th>
            ))}
            <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-secondary">Week</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const weekTotal = [...row.byDay.values()].reduce((a, b) => a + b, 0);
            return (
              <tr key={row.id} className="border-b border-hairline last:border-0 hover:bg-sunken/60">
                <td className="px-4 py-2.5">
                  <Link href={`/time?person=${row.id}&week=${weekParam}`} className="text-primary hover:underline">{row.name}</Link>
                </td>
                {days.map((day) => {
                  const minutes = row.byDay.get(toDayString(day)) ?? 0;
                  return (
                    <td key={day.toISOString()} className={`px-2 py-2.5 text-right font-mono tabular-nums ${minutes ? "text-primary" : "text-muted"}`}>
                      {minutes ? toHours(minutes) : "–"}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-primary">{toHours(weekTotal)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-hairline bg-sunken/50">
            <th scope="row" className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-secondary">Total hours</th>
            {dayTotals.map((minutes, i) => (
              <td key={i} className="px-2 py-2.5 text-right font-mono tabular-nums text-secondary">{minutes ? toHours(minutes) : "–"}</td>
            ))}
            <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-primary">{toHours(grand)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
