import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  CircleCheckBig,
  Clock,
  FileText,
  FolderOpen,
  Gavel,
  ListTodo,
  Megaphone,
  Moon,
  Sun,
  Sunrise,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

import { CasesByStatusChart } from "@/components/reports/charts";
import { ROLE_LABELS, canViewReports } from "@/lib/auth/roles";
import { requireUser } from "@/lib/dal";
import { getDashboardData, getOversightData } from "@/lib/dashboard/queries";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/documents/constants";
import { FIRM_NAME } from "@/lib/firm";
import { serverNow } from "@/lib/time";

export const metadata: Metadata = {
  title: `Dashboard · ${FIRM_NAME}`,
};

/**
 * The dashboard answers one question first: what needs doing today.
 *
 * The layout reads as a briefing — the day's schedule takes the widest
 * column, the reader's own workload and standing figures sit beside it as
 * tinted tiles, and firm-wide oversight comes last because it informs rather
 * than prompts. Anything overdue is pulled out of that order into a banner at
 * the top, since a late filing outranks everything else on the page.
 *
 * Colour here is a wayfinding device, not an encoding: a card and its tiles
 * share one tone so the eye can return to the same block. The one place
 * colour carries meaning is the schedule, where proximity (today / tomorrow /
 * later) drives the dot and the badge — and both are labelled, so the meaning
 * never rests on hue alone.
 */

const DAY_MS = 86_400_000;

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
const clockFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});
const weekdayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

function daysBetween(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
}

/* ── Tone system ──────────────────────────────────────────────────────────
   Complete literal class strings: Tailwind's scanner cannot resolve an
   interpolated class name, so every variant is written out in full. `head`
   tints a card's icon badge; `tile`/`chip`/`value` dress a stat tile.
   ------------------------------------------------------------------------ */
type Tone = "green" | "blue" | "purple" | "amber" | "teal" | "rose";

const TONES: Record<
  Tone,
  { head: string; tile: string; chip: string; value: string }
> = {
  green: {
    head: "bg-accent-50 text-accent-700",
    tile: "border-accent-100 bg-accent-50/70",
    chip: "bg-raised text-accent-700",
    value: "text-accent-800",
  },
  blue: {
    head: "bg-status-filed/10 text-status-filed",
    tile: "border-status-filed/20 bg-status-filed/10",
    chip: "bg-raised text-status-filed",
    value: "text-status-filed",
  },
  purple: {
    head: "bg-status-judgment/10 text-status-judgment",
    tile: "border-status-judgment/20 bg-status-judgment/10",
    chip: "bg-raised text-status-judgment",
    value: "text-status-judgment",
  },
  amber: {
    head: "bg-warning-soft text-warning",
    tile: "border-warning/25 bg-warning-soft",
    chip: "bg-raised text-warning",
    value: "text-warning",
  },
  teal: {
    head: "bg-success-soft text-success",
    tile: "border-success/25 bg-success-soft",
    chip: "bg-raised text-success",
    value: "text-success",
  },
  rose: {
    head: "bg-danger-soft text-danger",
    tile: "border-danger/25 bg-danger-soft",
    chip: "bg-raised text-danger",
    value: "text-danger",
  },
};

/** Derived from the hour, not hardcoded. */
function greeting(now: Date): { text: string; icon: LucideIcon; tone: Tone } {
  const hour = now.getHours();
  if (hour < 12) return { text: "Good morning", icon: Sunrise, tone: "amber" };
  if (hour < 17) return { text: "Good afternoon", icon: Sun, tone: "amber" };
  return { text: "Good evening", icon: Moon, tone: "purple" };
}

/** Proximity styling for the schedule. Always paired with a text label. */
const WHEN_STYLES = {
  today: {
    dot: "bg-warning",
    badge: "border-warning/30 bg-warning-soft text-warning",
  },
  tomorrow: {
    dot: "bg-status-filed",
    badge: "border-status-filed/25 bg-status-filed/10 text-status-filed",
  },
  later: {
    dot: "bg-status-judgment",
    badge: "border-hairline bg-sunken text-secondary",
  },
} as const;

function Card({
  icon: Icon,
  tone,
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-hairline bg-raised p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONES[tone].head}`}
          >
            <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-sans text-[15px] font-semibold text-primary">
              {title}
            </h2>
            {subtitle ? (
              <p className="truncate text-xs text-muted">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {action ? (
          <Link
            href={action.href}
            className="group inline-flex shrink-0 items-center gap-0.5 pt-1 text-xs font-semibold text-accent-700 transition-colors hover:text-accent-900"
          >
            {action.label}
            <ChevronRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        ) : null}
      </div>

      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Icon, label, figure. The whole tile is the hit target when it links. */
function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: number;
  href?: string;
}) {
  const t = TONES[tone];

  const inner = (
    <>
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg border border-hairline/50 ${t.chip}`}
      >
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-secondary">
          {label}
        </span>
        <span
          className={`block font-serif text-2xl font-bold leading-tight tabular-nums ${t.value}`}
        >
          {value}
        </span>
      </span>
    </>
  );

  const shell = `flex items-center gap-3 rounded-xl border p-3.5 ${t.tile}`;

  return href ? (
    <Link
      href={href}
      className={`${shell} transition-colors hover:border-hairline-strong`}
    >
      {inner}
    </Link>
  ) : (
    <div className={shell}>{inner}</div>
  );
}

function Blank({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-hairline px-4 py-9 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const now = serverNow();

  const [data, oversight] = await Promise.all([
    getDashboardData(user, now),
    getOversightData(user, now),
  ]);

  const firstName = user.name.split(" ")[0] ?? user.name;
  const hello = greeting(now);
  const HelloIcon = hello.icon;

  // ── The one line that says whether today needs anything ───────────────
  const prompts: string[] = [];
  if (data.myOverdue > 0) {
    prompts.push(
      `${data.myOverdue} overdue task${data.myOverdue === 1 ? "" : "s"}`,
    );
  }
  if (data.hearingsSoon > 0) {
    prompts.push(
      `${data.hearingsSoon} hearing${data.hearingsSoon === 1 ? "" : "s"} today or tomorrow`,
    );
  }
  if (data.unreadNotices > 0) {
    prompts.push(
      `${data.unreadNotices} notice${data.unreadNotices === 1 ? "" : "s"} to acknowledge`,
    );
  }

  const scopeNote = oversight
    ? oversight.isFirmWide
      ? "firm-wide view"
      : "your matters and your team's"
    : "matters you are assigned to";

  return (
    <div className="space-y-5">
      {/* ── Greeting ────────────────────────────────────────────────── */}
      {/* The date now lives in the top bar, so this header carries only the
          greeting and what the reader's role means for the page below it. */}
      <header className="flex items-center gap-4">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-2xl ${TONES[hello.tone].head}`}
        >
          <HelloIcon className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-[26px] leading-tight">
            {hello.text}, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {ROLE_LABELS[user.role]} · {scopeNote}
          </p>
        </div>
      </header>

      {prompts.length > 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3">
          <TriangleAlert
            className="size-5 shrink-0 text-warning"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 text-sm text-primary">
            <span className="font-semibold">Needs attention today:</span>{" "}
            {prompts.join(" · ")}
          </p>
        </div>
      ) : null}

      {/* ── Schedule + the reader's own numbers ─────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <Card
          icon={CalendarDays}
          tone="green"
          title="Today's Schedule"
          subtitle={dayFmt.format(now)}
          action={{ href: "/diary", label: "View all" }}
        >
          {data.upcomingHearings.length === 0 ? (
            <Blank>
              No hearings scheduled. The court diary holds the full calendar.
            </Blank>
          ) : (
            <ul className="divide-y divide-hairline">
              {data.upcomingHearings.map((hearing) => {
                const days = daysBetween(hearing.date, now);
                const when =
                  days <= 0 ? "today" : days === 1 ? "tomorrow" : "later";
                const style = WHEN_STYLES[when];

                return (
                  <li key={hearing.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      href={`/cases/${hearing.caseId}/hearings`}
                      className="group flex items-start gap-3"
                    >
                      <span
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${style.dot}`}
                        aria-hidden="true"
                      />
                      <span className="w-14 shrink-0 pt-px font-mono text-xs tabular-nums text-secondary">
                        {clockFmt.format(hearing.date)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-primary group-hover:underline">
                          {hearing.case.title}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          <span className="font-mono">
                            {hearing.case.caseNumber}
                          </span>
                          {" · "}
                          {hearing.court}
                          {" · "}
                          {hearing.purpose}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style.badge}`}
                      >
                        {when === "today"
                          ? "Today"
                          : when === "tomorrow"
                            ? "Tomorrow"
                            : weekdayFmt.format(hearing.date)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card
            icon={Briefcase}
            tone="green"
            title="Your Work"
            subtitle="Track your daily tasks and progress"
            action={{ href: "/tasks", label: "View all" }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile
                icon={ListTodo}
                tone="green"
                label="To do"
                value={data.myTasksByStatus.TODO}
                href="/tasks"
              />
              <StatTile
                icon={Clock}
                tone="blue"
                label="In progress"
                value={data.myTasksByStatus.IN_PROGRESS}
                href="/tasks"
              />
              <StatTile
                icon={CircleCheckBig}
                tone="purple"
                label="Completed"
                value={data.myTasksByStatus.DONE}
                href="/tasks"
              />
            </div>

            {/* Grows only when something is actually late. */}
            {data.myOverdue > 0 ? (
              <Link
                href="/tasks?due=overdue"
                className="mt-3 flex items-center gap-2 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-xs font-medium text-danger transition-colors hover:border-danger/50"
              >
                <TriangleAlert
                  className="size-4 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  {data.myOverdue} task{data.myOverdue === 1 ? "" : "s"} past
                  the due date
                </span>
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
            ) : null}
          </Card>

          <Card icon={BarChart3} tone="blue" title="At a glance">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile
                icon={FolderOpen}
                tone="green"
                label="Open matters"
                value={data.myCases}
                href="/cases"
              />
              <StatTile
                icon={Gavel}
                tone="blue"
                label="Hearings soon"
                value={data.hearingsSoon}
                href="/diary"
              />
              <StatTile
                icon={CalendarClock}
                tone="purple"
                label="Due this week"
                value={data.myDueThisWeek}
                href="/tasks"
              />
              <StatTile
                icon={Megaphone}
                tone="amber"
                label="Notices to read"
                value={data.unreadNotices}
                href="/notices"
              />
            </div>
          </Card>
        </div>
      </div>

      {/* ── Oversight + case mix ────────────────────────────────────── */}
      <div
        className={`grid gap-5 ${oversight ? "xl:grid-cols-[1fr_1.5fr]" : ""}`}
      >
        {oversight ? (
          <Card
            icon={Users}
            tone="teal"
            title={
              oversight.isFirmWide ? "Across the Firm" : "Across Your Team"
            }
            subtitle={
              oversight.isFirmWide
                ? "Every matter on the books"
                : "You and everyone reporting to you"
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile
                icon={FolderOpen}
                tone="green"
                label="Open matters"
                value={oversight.openCases}
                href="/cases"
              />
              <StatTile
                icon={CalendarDays}
                tone="blue"
                label="Hearings this week"
                value={oversight.hearingsThisWeek}
                href="/diary"
              />
              <StatTile
                icon={TriangleAlert}
                tone={oversight.overdueAcrossScope > 0 ? "rose" : "purple"}
                label="Overdue tasks"
                value={oversight.overdueAcrossScope}
                href="/tasks"
              />
              <StatTile
                icon={Briefcase}
                tone={oversight.unassignedCases > 0 ? "amber" : "teal"}
                label="Unassigned"
                value={oversight.unassignedCases}
                href="/cases"
              />
            </div>

            {oversight.unassignedCases > 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-secondary">
                Unassigned matters are invisible to everyone except partners —
                worth putting someone on them.
              </p>
            ) : null}
          </Card>
        ) : null}

        <Card
          icon={BarChart3}
          tone="purple"
          title="Matters by Status"
          subtitle="Where the caseload sits in the lifecycle"
          action={
            canViewReports(user.role)
              ? { href: "/reports", label: "View report" }
              : undefined
          }
        >
          <CasesByStatusChart
            data={data.casesByStatus}
            showValues
            height={232}
          />
        </Card>
      </div>

      {/* ── Recent filing activity ──────────────────────────────────── */}
      <Card
        icon={FileText}
        tone="amber"
        title="Recently Filed"
        subtitle="The latest documents added to your matters"
        action={{ href: "/documents", label: "View all" }}
      >
        {data.recentDocuments.length === 0 ? (
          <Blank>Nothing filed yet.</Blank>
        ) : (
          <ul className="divide-y divide-hairline">
            {data.recentDocuments.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-hairline/50 bg-sunken text-secondary">
                  <FileText
                    className="size-[18px]"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </span>
                <Link
                  href={`/cases/${doc.caseId}/documents`}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  {doc.title}
                </Link>
                <span className="shrink-0 text-xs text-muted">
                  {DOCUMENT_CATEGORY_LABELS[doc.category]}
                  {" · "}
                  <span className="font-mono">{doc.case.caseNumber}</span>
                  {" · "}
                  {doc.uploadedBy.name}
                  {" · "}
                  {shortFmt.format(doc.uploadedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
