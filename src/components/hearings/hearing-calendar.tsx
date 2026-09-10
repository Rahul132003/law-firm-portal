"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  MapPin,
  Clock,
  Building2,
  FileText,
  User,
  ArrowUpRight,
  X,
  Printer,
  Eye,
  Calendar as CalendarIcon,
  History,
  CalendarClock,
  Pencil,
  TriangleAlert,
} from "lucide-react";

/* ────────────────────────────────────────────────────────── */
/*  Types                                                     */
/* ────────────────────────────────────────────────────────── */

export type CalendarHearing = {
  id: string;
  date: Date;
  court: string;
  purpose: string;
  notes?: string | null;
  nextDate?: Date | null;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  clientName?: string | null;
  caseStatus?: string | null;
  /** The case's most recent earlier hearing date, if any. */
  previousDate?: Date | null;
};

type ViewMode = "month" | "week" | "agenda";

import {
  getHearingsOnDate,
  updateHearingNextDate,
  type DateClashHearing,
} from "@/lib/hearings/actions";

/* ────────────────────────────────────────────────────────── */
/*  Purpose → colour mapping                                  */
/* ────────────────────────────────────────────────────────── */

const PURPOSE_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  Trial:           { bg: "bg-warning-soft",   text: "text-warning",   border: "border-warning/30",  dot: "bg-warning" },
  Arguments:       { bg: "bg-accent-50",     text: "text-accent-700",     border: "border-accent-200",    dot: "bg-accent-700" },
  Evidence:        { bg: "bg-sunken",  text: "text-status-judgment",  border: "border-hairline", dot: "bg-status-judgment" },
  Hearing:         { bg: "bg-success-soft", text: "text-success", border: "border-success/30",dot: "bg-success" },
  Mention:         { bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-300",   dot: "bg-teal-500" },
  Judgment:        { bg: "bg-sunken",  text: "text-status-judgment",  border: "border-hairline", dot: "bg-status-judgment" },
  "Final Hearing": { bg: "bg-danger-soft",    text: "text-danger",    border: "border-danger/30",   dot: "bg-danger" },
  Order:           { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-300",   dot: "bg-blue-500" },
};

function getPurposeColor(purpose: string) {
  const key = Object.keys(PURPOSE_COLORS).find((k) =>
    purpose.toLowerCase().includes(k.toLowerCase()),
  );
  return key
    ? PURPOSE_COLORS[key]
    : {
        bg: "bg-sunken",
        text: "text-secondary",
        border: "border-hairline-strong",
        dot: "bg-muted",
      };
}

/* ────────────────────────────────────────────────────────── */
/*  Date helpers                                              */
/* ────────────────────────────────────────────────────────── */

function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** `yyyy-mm-dd`, what a native date input expects and returns. */
function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDateFull(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
] as const;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/* ────────────────────────────────────────────────────────── */
/*  Component                                                 */
/* ────────────────────────────────────────────────────────── */

export function HearingCalendar({
  year,
  month,
  hearings,
  canEdit = false,
}: {
  year: number;
  /** 0-indexed, matching Date. */
  month: number;
  hearings: CalendarHearing[];
  /** Whether this viewer may edit a hearing's next date inline. */
  canEdit?: boolean;
}) {
  const router = useRouter();

  /* ── local state ────────────────────────────────────────── */
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [courtFilter, setCourtFilter] = useState("ALL");
  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activeHearing, setActiveHearing] = useState<CalendarHearing | null>(null);

  const now = new Date();
  const isThisMonth = now.getFullYear() === year && now.getMonth() === month;
  const todayDate = now.getDate();

  /* ── distinct filter options ────────────────────────────── */
  const courts = useMemo(() => {
    const s = new Set<string>();
    hearings.forEach((h) => h.court && s.add(h.court));
    return Array.from(s).sort();
  }, [hearings]);

  const purposes = useMemo(() => {
    const s = new Set<string>();
    hearings.forEach((h) => h.purpose && s.add(h.purpose));
    return Array.from(s).sort();
  }, [hearings]);

  /* ── filtered list ──────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return hearings.filter((h) => {
      if (q) {
        const hay = [h.caseTitle, h.caseNumber, h.purpose, h.court, h.clientName ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (courtFilter !== "ALL" && h.court !== courtFilter) return false;
      if (purposeFilter !== "ALL" && h.purpose !== purposeFilter) return false;
      return true;
    });
  }, [hearings, searchQuery, courtFilter, purposeFilter]);

  const hasFilters = searchQuery || courtFilter !== "ALL" || purposeFilter !== "ALL";

  /* ── by-day map (for month grid) ────────────────────────── */
  const byDay = useMemo(() => {
    const map = new Map<number, CalendarHearing[]>();
    for (const h of filtered) {
      const d = new Date(h.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const list = map.get(day) ?? [];
        list.push(h);
        map.set(day, list);
      }
    }
    map.forEach((list) =>
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    );
    return map;
  }, [filtered, year, month]);

  /* ── month grid cells ───────────────────────────────────── */
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells = useMemo(() => {
    const arr: { day: number; current: boolean }[] = [];
    for (let i = leadingBlanks - 1; i >= 0; i--)
      arr.push({ day: daysInPrev - i, current: false });
    for (let d = 1; d <= daysInMonth; d++) arr.push({ day: d, current: true });
    while (arr.length % 7 !== 0)
      arr.push({ day: arr.length - leadingBlanks - daysInMonth + 1, current: false });
    return arr;
  }, [leadingBlanks, daysInMonth, daysInPrev]);

  /* ── navigation ─────────────────────────────────────────── */
  function go(y: number, m: number) {
    router.push(`/diary?year=${y}&month=${m}`);
  }
  const prev = () => go(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
  const next = () => go(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1);

  /* ── selected-day data ──────────────────────────────────── */
  const dayHearings = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  /* ── clear all filters ──────────────────────────────────── */
  function resetFilters() {
    setSearchQuery("");
    setCourtFilter("ALL");
    setPurposeFilter("ALL");
  }

  /* ════════════════════════════════════════════════════════ */
  /*  Render                                                  */
  /* ════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-4 print:space-y-2">
      {/* ── Toolbar ─────────────────────────────────────── */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left — Date nav + quick jump */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Prev / Today / Next cluster */}
            <div className="flex items-center rounded-xl border border-hairline bg-sunken/80 p-1">
              <button
                type="button"
                onClick={prev}
                className="flex size-8 items-center justify-center rounded-lg text-secondary transition hover:bg-white hover:text-accent-700 hover:shadow-xs active:scale-95"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => go(now.getFullYear(), now.getMonth())}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  isThisMonth
                    ? "bg-accent-700 text-white shadow-xs"
                    : "text-secondary hover:bg-white hover:text-accent-700"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={next}
                className="flex size-8 items-center justify-center rounded-lg text-secondary transition hover:bg-white hover:text-accent-700 hover:shadow-xs active:scale-95"
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* Month & year selectors */}
            <div className="flex items-center gap-2">
              <Selector
                value={month}
                onChange={(v) => go(year, v)}
                options={MONTHS.map((n, i) => ({ label: n, value: i }))}
              />
              <Selector
                value={year}
                onChange={(v) => go(v, month)}
                options={Array.from({ length: 15 }, (_, i) => {
                  const y = year - 7 + i;
                  return { label: String(y), value: y };
                })}
              />
            </div>
          </div>

          {/* Right — view switcher + print */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-xl border border-hairline bg-sunken/80 p-1">
              {(
                [
                  { key: "month", Icon: CalendarDays, label: "Month" },
                  { key: "week", Icon: CalendarRange, label: "Week" },
                  { key: "agenda", Icon: ListIcon, label: "Agenda" },
                ] as const
              ).map(({ key, Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewMode(key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    viewMode === key
                      ? "bg-white text-accent-700 shadow-xs ring-1 ring-hairline"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-white px-3 py-1.5 text-xs font-bold text-secondary shadow-xs transition hover:border-accent-200 hover:text-accent-700"
              title="Print diary"
            >
              <Printer className="size-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* ── Search / filter bar ──────────────────────── */}
        <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search case, court, purpose, client…"
              className="w-full rounded-xl border border-hairline bg-sunken/50 py-2 pl-9 pr-8 text-xs font-medium text-primary placeholder:text-muted transition focus:border-accent-600 focus:bg-white focus:ring-2 focus:ring-accent-600/20 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {courts.length > 0 && (
              <Selector
                value={courtFilter}
                onChange={(v) => setCourtFilter(v)}
                options={[
                  { label: `All Courts (${courts.length})`, value: "ALL" },
                  ...courts.map((c) => ({ label: c, value: c })),
                ]}
                small
              />
            )}

            {purposes.length > 0 && (
              <Selector
                value={purposeFilter}
                onChange={(v) => setPurposeFilter(v)}
                options={[
                  { label: `All Types (${purposes.length})`, value: "ALL" },
                  ...purposes.map((p) => ({ label: p, value: p })),
                ]}
                small
              />
            )}

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-xl bg-danger-soft px-2.5 py-1.5 text-xs font-bold text-danger transition hover:bg-danger-soft"
              >
                <X className="size-3" />
                Reset ({filtered.length} shown)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  MONTH VIEW                                         */}
      {/* ═══════════════════════════════════════════════════ */}
      {viewMode === "month" && (
        <div className="card overflow-hidden border border-hairline/90 shadow-sm">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-hairline bg-sunken">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`py-2.5 text-center text-[11px] font-bold uppercase tracking-wider ${
                  i >= 5 ? "bg-sunken/40 text-muted" : "text-secondary"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-hairline/80 bg-sunken/40">
            {cells.map((cell, idx) => {
              const items = cell.current ? (byDay.get(cell.day) ?? []) : [];
              const isToday = isThisMonth && cell.current && cell.day === todayDate;
              const isWe = idx % 7 >= 5;
              const isSel = cell.current && selectedDay === cell.day;

              return (
                <div
                  key={idx}
                  onClick={() => cell.current && setSelectedDay(cell.day)}
                  className={`group relative min-h-[110px] cursor-pointer p-2 transition-all ${
                    !cell.current
                      ? "bg-sunken/60 opacity-40"
                      : isSel
                        ? "z-10 bg-accent-50/70 ring-2 ring-inset ring-accent-600"
                        : isToday
                          ? "bg-accent-50/30 hover:bg-accent-50/50"
                          : isWe
                            ? "bg-sunken/40 hover:bg-white"
                            : "bg-white hover:bg-sunken/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold transition-transform group-hover:scale-105 ${
                        isToday
                          ? "bg-accent-700 text-white ring-2 ring-accent-200"
                          : cell.current
                            ? "text-secondary"
                            : "text-muted"
                      }`}
                    >
                      {cell.day}
                    </span>

                    {items.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-50/80 px-1.5 py-0.5 text-[10px] font-bold text-accent-700">
                        <span className="size-1.5 rounded-full bg-accent-700" />
                        {items.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 space-y-1">
                    {items.slice(0, 3).map((h) => {
                      const c = getPurposeColor(h.purpose);
                      return (
                        <div
                          key={h.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveHearing(h);
                          }}
                          className={`group/item flex items-center justify-between gap-1 rounded-lg border px-1.5 py-1 text-[11px] font-medium transition hover:scale-[1.02] hover:shadow-xs ${c.bg} ${c.border} ${c.text}`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span className={`size-1.5 shrink-0 rounded-full ${c.dot}`} />
                            <span className="truncate font-bold">{fmtTime(new Date(h.date))}</span>
                            <span className="hidden truncate opacity-90 sm:inline">{h.caseNumber}</span>
                          </div>
                          <Eye className="size-2.5 shrink-0 opacity-0 transition-opacity group-hover/item:opacity-100" />
                        </div>
                      );
                    })}

                    {items.length > 3 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(cell.day);
                        }}
                        className="w-full rounded-md px-1 py-0.5 text-left text-[10px] font-bold text-muted transition hover:bg-sunken/60 hover:text-accent-700"
                      >
                        +{items.length - 3} more…
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/*  WEEK VIEW                                          */}
      {/* ═══════════════════════════════════════════════════ */}
      {viewMode === "week" && (
        <div className="card divide-y divide-hairline overflow-hidden">
          <div className="border-b border-hairline bg-sunken p-4">
            <h3 className="text-sm font-bold text-primary">
              Weekly Cause List · {MONTHS[month]} {year}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Detailed multi-day schedule with case numbers and court venues.
            </p>
          </div>

          <div className="divide-y divide-hairline">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1)
              .filter((day) => (byDay.get(day) ?? []).length > 0)
              .map((day) => {
                const items = byDay.get(day)!;
                const d = new Date(year, month, day);
                const isToday = isThisMonth && day === todayDate;

                return (
                  <div
                    key={day}
                    className={`p-4 transition ${isToday ? "bg-accent-50/40" : "hover:bg-sunken/50"}`}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span
                        className={`inline-flex items-center justify-center rounded-xl px-2.5 py-1 text-xs font-extrabold ${
                          isToday
                            ? "bg-accent-700 text-white shadow-xs"
                            : "border border-hairline bg-sunken text-primary"
                        }`}
                      >
                        {new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d)},{" "}
                        {day} {MONTHS[month]}
                      </span>
                      <span className="text-xs font-semibold text-muted">
                        {items.length} {items.length === 1 ? "hearing" : "hearings"}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((h) => {
                        const c = getPurposeColor(h.purpose);
                        return (
                          <div
                            key={h.id}
                            onClick={() => setActiveHearing(h)}
                            className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-hairline bg-white p-3.5 shadow-2xs transition hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-md"
                          >
                            <div>
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${c.bg} ${c.text} ${c.border}`}
                                >
                                  <span className={`size-1.5 rounded-full ${c.dot}`} />
                                  {h.purpose}
                                </span>
                                <span className="rounded-md bg-sunken px-2 py-0.5 font-mono text-xs font-bold text-secondary">
                                  {fmtTime(new Date(h.date))}
                                </span>
                              </div>

                              <h4 className="line-clamp-1 text-sm font-bold text-primary transition group-hover:text-accent-700">
                                {h.caseTitle}
                              </h4>
                              <p className="mt-0.5 font-mono text-xs text-muted">{h.caseNumber}</p>

                              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-secondary">
                                <MapPin className="size-3 shrink-0 text-muted" />
                                <span className="truncate">{h.court}</span>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2 text-[11px]">
                              <span className="truncate text-muted">
                                {h.clientName ? `Client: ${h.clientName}` : "Case File"}
                              </span>
                              <span className="inline-flex items-center gap-0.5 font-semibold text-accent-700 group-hover:underline">
                                Details <ArrowUpRight className="size-3" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            {/* Empty week view */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(
              (day) => (byDay.get(day) ?? []).length > 0,
            ).length === 0 && <EmptyState month={MONTHS[month]} year={year} />}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/*  AGENDA VIEW                                        */}
      {/* ═══════════════════════════════════════════════════ */}
      {viewMode === "agenda" && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-hairline bg-sunken p-4">
            <div>
              <h3 className="text-sm font-bold text-primary">
                Diary Agenda · {MONTHS[month]} {year}
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                {filtered.length} court appearance{filtered.length !== 1 ? "s" : ""}.
              </p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState month={MONTHS[month]} year={year} />
          ) : (
            <div className="divide-y divide-hairline">
              {filtered.map((h) => {
                const c = getPurposeColor(h.purpose);
                const d = new Date(h.date);
                const isToday = isThisMonth && d.getDate() === todayDate;

                return (
                  <div
                    key={h.id}
                    className={`flex flex-col gap-3 p-4 transition hover:bg-sunken/80 sm:flex-row sm:items-center sm:justify-between ${
                      isToday ? "bg-accent-50/30" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {/* Date badge */}
                      <div className="flex min-w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-hairline bg-white p-2 text-center shadow-2xs">
                        <span className="text-[10px] font-bold uppercase text-muted">
                          {new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d)}
                        </span>
                        <span className="text-lg font-black leading-tight text-primary">
                          {d.getDate()}
                        </span>
                        <span className="text-[10px] font-medium text-muted">
                          {new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d)}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${c.bg} ${c.text} ${c.border}`}
                          >
                            <span className={`size-1.5 rounded-full ${c.dot}`} />
                            {h.purpose}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-sunken px-2 py-0.5 font-mono text-xs font-semibold text-secondary">
                            <Clock className="size-3 text-muted" />
                            {fmtTime(d)}
                          </span>
                          {isToday && (
                            <span className="rounded-full bg-accent-700 px-2 py-0.5 text-[10px] font-extrabold text-white">
                              Today
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/cases/${h.caseId}/hearings`}
                          className="block truncate text-sm font-bold text-primary transition hover:text-accent-700"
                        >
                          {h.caseTitle}
                        </Link>
                        <p className="font-mono text-xs text-muted">
                          {h.caseNumber}
                          {h.clientName ? ` · Client: ${h.clientName}` : ""}
                        </p>

                        <div className="mt-1 flex items-center gap-1.5 text-xs text-secondary">
                          <MapPin className="size-3 shrink-0 text-muted" />
                          <span className="truncate">{h.court}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-2 sm:self-center">
                      <button
                        type="button"
                        onClick={() => setActiveHearing(h)}
                        className="rounded-xl border border-hairline bg-white px-3 py-1.5 text-xs font-bold text-secondary shadow-xs transition hover:border-accent-200 hover:text-accent-700"
                      >
                        Quick View
                      </button>
                      <Link
                        href={`/cases/${h.caseId}/hearings`}
                        className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-accent-700"
                      >
                        Manage <ArrowUpRight className="size-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/*  DAY MODAL                                          */}
      {/* ═══════════════════════════════════════════════════ */}
      {selectedDay !== null && (
        <Modal onClose={() => setSelectedDay(null)}>
          <div className="flex items-center justify-between border-b border-hairline bg-sunken/80 px-5 py-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-accent-700">
                Court Cause List
              </span>
              <h3 className="text-base font-extrabold text-primary">
                {fmtDateFull(new Date(year, month, selectedDay))}
              </h3>
            </div>
            <CloseBtn onClick={() => setSelectedDay(null)} />
          </div>

          <div className="space-y-3 overflow-y-auto p-5" style={{ maxHeight: "60vh" }}>
            {dayHearings.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-sunken text-muted">
                  <CalendarIcon className="size-6" />
                </div>
                <p className="text-sm font-bold text-secondary">No hearings on this day</p>
                <p className="mt-1 text-xs text-muted">
                  No court appearances scheduled for this date.
                </p>
              </div>
            ) : (
              dayHearings.map((h) => (
                <HearingCard
                  key={h.id}
                  hearing={h}
                  onOpen={() => {
                    setSelectedDay(null);
                    setActiveHearing(h);
                  }}
                />
              ))
            )}
          </div>

          <div className="flex justify-end border-t border-hairline bg-sunken/50 px-5 py-3">
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="rounded-xl border border-hairline bg-white px-4 py-1.5 text-xs font-bold text-secondary shadow-xs hover:bg-sunken"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/*  HEARING QUICK-VIEW MODAL                           */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeHearing && (
        <Modal onClose={() => setActiveHearing(null)} narrow>
          <div className="flex items-center justify-between border-b border-hairline bg-sunken/80 px-5 py-4">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-accent-700">
                Hearing Details
              </span>
              <h3 className="max-w-[280px] truncate text-sm font-extrabold text-primary">
                {activeHearing.caseTitle}
              </h3>
            </div>
            <CloseBtn onClick={() => setActiveHearing(null)} />
          </div>

          <div className="space-y-4 p-5">
            {(() => {
              const c = getPurposeColor(activeHearing.purpose);
              return (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold ${c.bg} ${c.text} ${c.border}`}
                    >
                      <span className={`size-1.5 rounded-full ${c.dot}`} />
                      {activeHearing.purpose}
                    </span>
                    <span className="flex items-center gap-1 rounded-md bg-sunken px-2.5 py-1 font-mono text-xs font-bold text-secondary">
                      <Clock className="size-3 text-muted" />
                      {fmtTime(new Date(activeHearing.date))}
                    </span>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-hairline bg-sunken/60 p-4 text-xs">
                    <Field label="Date" value={fmtDateFull(new Date(activeHearing.date))} bold />
                    <Field label="Case Number" value={activeHearing.caseNumber} mono />
                    <Field
                      label="Court Venue"
                      value={activeHearing.court}
                      icon={<MapPin className="size-3.5 text-accent-600" />}
                    />
                    {activeHearing.clientName && (
                      <Field label="Client" value={activeHearing.clientName} />
                    )}
                    {activeHearing.notes && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                          Notes / Instructions
                        </span>
                        <p className="mt-1 whitespace-pre-wrap rounded-xl border border-hairline bg-white p-2.5 text-xs text-secondary">
                          {activeHearing.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ── Previous hearing ─────────────────────────── */}
                  <div className="rounded-2xl border border-hairline bg-white p-4">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                      <History className="size-3.5" />
                      Previous Hearing
                    </span>
                    <p className="mt-1 text-sm font-semibold text-primary">
                      {activeHearing.previousDate
                        ? fmtDateFull(activeHearing.previousDate)
                        : "This is the first listed hearing on this matter."}
                    </p>
                  </div>

                  {/* ── Next hearing date, editable inline ──────────── *
                   * Keyed on the hearing id so its own edit/clash state    *
                   * resets automatically when a different hearing opens — *
                   * a plain remount, not a manual reset-in-effect.        */}
                  <NextHearingDateEditor
                    key={activeHearing.id}
                    hearing={activeHearing}
                    canEdit={canEdit}
                  />
                </>
              );
            })()}
          </div>

          <div className="flex items-center justify-between border-t border-hairline bg-sunken/50 px-5 py-3">
            <button
              type="button"
              onClick={() => setActiveHearing(null)}
              className="rounded-xl border border-hairline bg-white px-3 py-1.5 text-xs font-bold text-secondary shadow-xs hover:bg-sunken"
            >
              Close
            </button>
            <Link
              href={`/cases/${activeHearing.caseId}/hearings`}
              className="inline-flex items-center gap-1 rounded-xl bg-accent-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-accent-700"
            >
              View Full Case <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Sub-components                                            */
/* ────────────────────────────────────────────────────────── */

function Selector<T extends string | number>({
  value,
  onChange,
  options,
  small,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { label: string; value: T }[];
  small?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          // preserve original type
          const typed = typeof value === "number" ? (Number(raw) as T) : (raw as T);
          onChange(typed);
        }}
        className={`appearance-none rounded-xl border border-hairline bg-white shadow-xs transition hover:border-accent-300 focus:border-accent-600 focus:ring-2 focus:ring-accent-600/20 focus:outline-hidden ${
          small
            ? "py-2 pl-3 pr-7 text-xs font-semibold text-secondary"
            : "py-1.5 pl-3 pr-8 text-sm font-bold text-primary"
        }`}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted">
        <ChevronDown className={small ? "size-3" : "size-3.5"} />
      </div>
    </div>
  );
}

function Modal({
  children,
  onClose,
  narrow,
}: {
  children: React.ReactNode;
  onClose: () => void;
  narrow?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: "calFadeIn .15s ease" }}
    >
      <div
        className={`card flex max-h-[85vh] flex-col overflow-hidden shadow-2xl ${
          narrow ? "w-full max-w-md" : "w-full max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "calScaleUp .2s ease" }}
      >
        {children}
      </div>
    </div>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-sunken/60 hover:text-secondary"
    >
      <X className="size-4" />
    </button>
  );
}

/**
 * The "Next Hearing Date" panel inside the Quick-View modal: read-only
 * display, an inline editor, and the same-date clash check that surfaces
 * while a date is being picked.
 *
 * Deliberately owns all of its edit/clash state itself rather than lifting
 * it into `HearingCalendar`. The parent renders this keyed on
 * `activeHearing.id`, so switching to a different hearing remounts it and
 * every field resets for free — no effect, no manual reset, and the state
 * genuinely belongs to "the editor for this one hearing", not to the
 * calendar as a whole.
 */
function NextHearingDateEditor({
  hearing,
  canEdit,
}: {
  hearing: CalendarHearing;
  canEdit: boolean;
}) {
  const router = useRouter();

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [clash, setClash] = useState<{
    date: string;
    hearings: DateClashHearing[];
  } | null>(null);
  const [clashLoading, setClashLoading] = useState(false);
  // Shown once a save succeeds, ahead of the server round trip that
  // refreshes the calendar's own `hearings` prop.
  const [savedDate, setSavedDate] = useState<Date | null | undefined>(
    undefined,
  );

  const displayedDate = savedDate !== undefined ? savedDate : (hearing.nextDate ?? null);

  /** Mirrors the server's rule so a doomed save never leaves the round trip. */
  function validateDraft(value: string): string | null {
    if (value === "") return null; // clearing the date is allowed
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return "That is not a valid date.";
    if (parsed.getTime() <= hearing.date.getTime()) {
      return "The next hearing must be after this one.";
    }
    return null;
  }

  function beginEdit() {
    setDraft(displayedDate ? toDateInputValue(displayedDate) : "");
    setError(null);
    setClash(null);
    setMode("edit");
  }

  function cancelEdit() {
    setMode("view");
    setError(null);
    setClash(null);
  }

  /**
   * Fires on every date the picker settles on (a `date` input changes once
   * per selection, not per keystroke, so no debounce is needed) and looks up
   * who else is already listed that day — the "all cases on same date"
   * check, surfaced right where a clash actually matters: while choosing it.
   */
  async function onDraftChange(value: string) {
    setDraft(value);
    setError(validateDraft(value));

    if (!value) {
      setClash(null);
      return;
    }

    setClashLoading(true);
    try {
      const rows = await getHearingsOnDate(value);
      setClash({
        date: value,
        // A matter is not a clash with itself.
        hearings: rows.filter((row) => row.id !== hearing.id),
      });
    } catch {
      setClash(null);
    } finally {
      setClashLoading(false);
    }
  }

  function save() {
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    startTransition(async () => {
      const result = await updateHearingNextDate(hearing.id, draft);
      if (!result.ok) {
        setError(result.message ?? "Could not save that date.");
        return;
      }

      setSavedDate(draft ? new Date(`${draft}T00:00:00`) : null);
      setMode("view");
      setClash(null);
      // Re-syncs the month grid, week and agenda views with the new date;
      // this panel already reflects it via `savedDate` above.
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
          <CalendarClock className="size-3.5" />
          Next Hearing Date
        </span>
        {canEdit && mode === "view" && (
          <button
            type="button"
            onClick={beginEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-white px-2 py-1 text-[11px] font-bold text-accent-700 shadow-2xs transition hover:border-accent-200 hover:bg-accent-50"
          >
            <Pencil className="size-3" />
            Edit
          </button>
        )}
      </div>

      {mode === "view" ? (
        <p className="mt-1 text-sm font-semibold text-primary">
          {displayedDate ? fmtDateFull(displayedDate) : "Not yet fixed."}
        </p>
      ) : (
        <div className="mt-2 space-y-2.5">
          <input
            type="date"
            value={draft}
            min={toDateInputValue(hearing.date)}
            disabled={pending}
            onChange={(e) => onDraftChange(e.target.value)}
            className="field-input"
            aria-label="Next hearing date"
          />

          {error && (
            <p className="text-xs font-semibold text-danger">{error}</p>
          )}

          {clashLoading && (
            <p className="text-xs text-muted">Checking that date…</p>
          )}

          {clash && clash.date === draft && clash.hearings.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning-soft p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-warning">
                <TriangleAlert className="size-3.5 shrink-0" />
                {clash.hearings.length} other matter
                {clash.hearings.length === 1 ? "" : "s"} already listed that
                day
              </p>
              <ul className="mt-1.5 space-y-1">
                {clash.hearings.slice(0, 5).map((row) => (
                  <li key={row.id} className="truncate text-xs text-secondary">
                    {fmtTime(new Date(row.date))} ·{" "}
                    <span className="font-mono">{row.caseNumber}</span> —{" "}
                    {row.caseTitle}
                  </li>
                ))}
                {clash.hearings.length > 5 && (
                  <li className="text-xs text-muted">
                    and {clash.hearings.length - 5} more…
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending || !!error}
              onClick={save}
              className="rounded-xl bg-accent-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={cancelEdit}
              className="rounded-xl border border-hairline bg-white px-3 py-1.5 text-xs font-bold text-secondary shadow-xs hover:bg-sunken"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HearingCard({
  hearing: h,
  onOpen,
}: {
  hearing: CalendarHearing;
  /** Opens this hearing in the Quick-View modal (previous date, editable
   *  next date, same-date clash check). */
  onOpen: () => void;
}) {
  const c = getPurposeColor(h.purpose);
  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 shadow-xs transition hover:border-accent-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold ${c.bg} ${c.text} ${c.border}`}
        >
          <span className={`size-1.5 rounded-full ${c.dot}`} />
          {h.purpose}
        </span>
        <span className="flex items-center gap-1 rounded-md bg-sunken px-2 py-0.5 font-mono text-xs font-bold text-secondary">
          <Clock className="size-3 text-muted" />
          {fmtTime(new Date(h.date))}
        </span>
      </div>

      <h4 className="text-sm font-extrabold text-primary">{h.caseTitle}</h4>
      <p className="mt-0.5 font-mono text-xs text-muted">{h.caseNumber}</p>

      <div className="mt-3 space-y-1.5 rounded-xl bg-sunken p-2.5 text-xs text-secondary">
        <div className="flex items-center gap-2">
          <Building2 className="size-3.5 shrink-0 text-muted" />
          <span className="font-semibold text-primary">{h.court}</span>
        </div>
        {h.clientName && (
          <div className="flex items-center gap-2">
            <User className="size-3.5 shrink-0 text-muted" />
            <span>Client: {h.clientName}</span>
          </div>
        )}
        {h.notes && (
          <div className="flex items-start gap-2 border-t border-hairline/60 pt-1">
            <FileText className="mt-0.5 size-3.5 shrink-0 text-muted" />
            <p className="italic text-secondary">{h.notes}</p>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-hairline/60 pt-2.5 text-[11px]">
        <div>
          <span className="flex items-center gap-1 font-bold uppercase tracking-wide text-muted">
            <History className="size-3" /> Previous
          </span>
          <span className="text-secondary">
            {h.previousDate ? fmtDateFull(h.previousDate) : "—"}
          </span>
        </div>
        <div>
          <span className="flex items-center gap-1 font-bold uppercase tracking-wide text-muted">
            <CalendarClock className="size-3" /> Next Date
          </span>
          <span className="text-secondary">
            {h.nextDate ? fmtDateFull(h.nextDate) : "Not fixed"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 rounded-xl border border-hairline bg-white px-3 py-1.5 text-xs font-bold text-secondary shadow-2xs transition hover:border-accent-200 hover:text-accent-700"
        >
          <Pencil className="size-3" /> View &amp; Edit
        </button>
        <Link
          href={`/cases/${h.caseId}/hearings`}
          className="inline-flex items-center gap-1 rounded-xl bg-accent-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-accent-700"
        >
          Open Case Diary <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
  bold,
  mono,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </span>
      <p
        className={`mt-0.5 flex items-center gap-1.5 ${
          bold ? "text-sm font-bold text-primary" : "text-xs font-semibold text-primary"
        } ${mono ? "font-mono" : ""}`}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}

function EmptyState({ month, year }: { month: string; year: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <CalendarIcon className="mb-2 size-10 text-muted" />
      <p className="text-sm font-bold text-secondary">No hearings found</p>
      <p className="mt-1 max-w-xs text-xs text-muted">
        No hearings matched your filter for {month} {year}.
      </p>
    </div>
  );
}
