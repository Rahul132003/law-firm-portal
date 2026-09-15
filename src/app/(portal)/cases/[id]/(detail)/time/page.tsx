import Link from "next/link";

import { TimerWidget } from "@/components/time/timer-widget";
import { EmptyState } from "@/components/ui/empty-state";
import { getCaseDetail } from "@/lib/cases/queries";
import { getCaseTime, getRunningTimer } from "@/lib/time-tracking/queries";
import { TIME_ACTIVITY_LABELS, formatMinutes, toHours } from "@/lib/time-tracking/rules";
import { serverNowMs } from "@/lib/time";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function CaseTimePage(props: PageProps<"/cases/[id]/time">) {
  const { id } = await props.params;

  // Both enforce case access.
  const [record, time] = await Promise.all([getCaseDetail(id), getCaseTime(id)]);
  if (!record) return null;
  const timer = await getRunningTimer(record.viewer.id);

  const maxPerson = Math.max(1, ...time.byPerson.map((p) => p.minutes));

  return (
    <div className="space-y-5">
      <TimerWidget
        nowMs={serverNowMs()}
        cases={[{ id: record.id, caseNumber: record.caseNumber, title: record.title }]}
        defaultCaseId={record.id}
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

      {time.totalMinutes === 0 ? (
        <EmptyState
          title="No time recorded on this case"
          description="Start the timer above, or add entries from the Time page."
          action={<Link href="/time" className="text-sm text-primary hover:underline">Go to Time →</Link>}
        />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <section className="card p-5">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Total recorded</h2>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-primary">{toHours(time.totalMinutes)}h</p>
              <p className="mt-1 text-xs text-secondary">{formatMinutes(time.totalMinutes)} across {time.byPerson.length} {time.byPerson.length === 1 ? "person" : "people"}</p>
            </section>

            <section className="card p-5 lg:col-span-2">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">By person</h2>
              <ul className="space-y-2">
                {time.byPerson.map((person) => (
                  <li key={person.name} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-3 text-sm">
                    <span className="truncate text-primary">{person.name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                      <span className="block h-full rounded-full bg-accent-600" style={{ width: `${(person.minutes / maxPerson) * 100}%` }} />
                    </span>
                    <span className="text-right font-mono tabular-nums text-secondary">{toHours(person.minutes)}h</span>
                  </li>
                ))}
              </ul>
              <h2 className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-muted">By activity</h2>
              <p className="flex flex-wrap gap-2">
                {time.byActivity.map((row) => (
                  <span key={row.activity} className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary">
                    {TIME_ACTIVITY_LABELS[row.activity]} <span className="font-mono text-primary">{toHours(row.minutes)}h</span>
                  </span>
                ))}
              </p>
            </section>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-primary">Recent entries</h2>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-hairline bg-sunken/80 text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-secondary">Date</th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-secondary">Person</th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-secondary">Work</th>
                    <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-secondary">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {time.recent.map((entry) => (
                    <tr key={entry.id} className="border-b border-hairline last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-secondary">{dateFormat.format(entry.workDate)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-primary">{entry.user.name}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-primary">{entry.description}</span>
                        <span className="block text-xs text-muted">{TIME_ACTIVITY_LABELS[entry.activity]}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono tabular-nums text-primary">{formatMinutes(entry.minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {time.recent.length === 100 ? <p className="mt-2 text-xs text-muted">Showing the latest 100 entries.</p> : null}
          </section>
        </>
      )}
    </div>
  );
}
