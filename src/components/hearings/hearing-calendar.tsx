"use client";

import { useState, useMemo } from "react";
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
};

type ViewMode = "month" | "week" | "agenda";

/* ────────────────────────────────────────────────────────── */
/*  Purpose → colour mapping                                  */
/* ────────────────────────────────────────────────────────── */

const PURPOSE_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  Trial:           { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-300",  dot: "bg-amber-500" },
  Arguments:       { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-300",    dot: "bg-sky-500" },
  Evidence:        { bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-300", dot: "bg-indigo-500" },
  Hearing:         { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300",dot: "bg-emerald-500" },
  Mention:         { bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-300",   dot: "bg-teal-500" },
  Judgment:        { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-300", dot: "bg-purple-500" },
  "Final Hearing": { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-300",   dot: "bg-rose-500" },
  Order:           { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-300",   dot: "bg-blue-500" },
};

function getPurposeColor(purpose: string) {
  const key = Object.keys(PURPOSE_COLORS).find((k) =>
    purpose.toLowerCase().includes(k.toLowerCase()),
  );
  return key
    ? PURPOSE_COLORS[key]
    : {
        bg: "bg-slate-50",
        text: "text-slate-700",
        border: "border-slate-300",
        dot: "bg-slate-400",
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
}: {
  year: number;
  /** 0-indexed, matching Date. */
  month: number;
  hearings: CalendarHearing[];
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
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-1">
              <button
                type="button"
                onClick={prev}
                className="flex size-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-sky-600 hover:shadow-xs active:scale-95"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => go(now.getFullYear(), now.getMonth())}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  isThisMonth
                    ? "bg-sky-500 text-white shadow-xs"
                    : "text-slate-700 hover:bg-white hover:text-sky-600"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={next}
                className="flex size-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-sky-600 hover:shadow-xs active:scale-95"
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
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
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
                      ? "bg-white text-sky-600 shadow-xs ring-1 ring-slate-200"
                      : "text-slate-600 hover:text-slate-900"
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:border-sky-300 hover:text-sky-700"
              title="Print diary"
            >
              <Printer className="size-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* ── Search / filter bar ──────────────────────── */}
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search case, court, purpose, client…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs font-medium text-slate-800 placeholder:text-slate-400 transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100"
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
        <div className="card overflow-hidden border border-slate-200/90 shadow-sm">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-slate-100/70 to-slate-50">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`py-2.5 text-center text-[11px] font-bold uppercase tracking-wider ${
                  i >= 5 ? "bg-slate-100/40 text-slate-400" : "text-slate-600"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200/80 bg-slate-200/40">
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
                      ? "bg-slate-50/60 opacity-40"
                      : isSel
                        ? "z-10 bg-sky-50/70 ring-2 ring-inset ring-sky-500"
                        : isToday
                          ? "bg-sky-50/30 hover:bg-sky-50/50"
                          : isWe
                            ? "bg-slate-50/40 hover:bg-white"
                            : "bg-white hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold transition-transform group-hover:scale-105 ${
                        isToday
                          ? "bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-xs ring-2 ring-sky-200"
                          : cell.current
                            ? "text-slate-700"
                            : "text-slate-400"
                      }`}
                    >
                      {cell.day}
                    </span>

                    {items.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100/80 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                        <span className="size-1.5 rounded-full bg-sky-500" />
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
                        className="w-full rounded-md px-1 py-0.5 text-left text-[10px] font-bold text-slate-500 transition hover:bg-slate-200/60 hover:text-sky-700"
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
        <div className="card divide-y divide-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-bold text-slate-800">
              Weekly Cause List · {MONTHS[month]} {year}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Detailed multi-day schedule with case numbers and court venues.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1)
              .filter((day) => (byDay.get(day) ?? []).length > 0)
              .map((day) => {
                const items = byDay.get(day)!;
                const d = new Date(year, month, day);
                const isToday = isThisMonth && day === todayDate;

                return (
                  <div
                    key={day}
                    className={`p-4 transition ${isToday ? "bg-sky-50/40" : "hover:bg-slate-50/50"}`}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span
                        className={`inline-flex items-center justify-center rounded-xl px-2.5 py-1 text-xs font-extrabold ${
                          isToday
                            ? "bg-sky-600 text-white shadow-xs"
                            : "border border-slate-200 bg-slate-100 text-slate-800"
                        }`}
                      >
                        {new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d)},{" "}
                        {day} {MONTHS[month]}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
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
                            className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
                          >
                            <div>
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${c.bg} ${c.text} ${c.border}`}
                                >
                                  <span className={`size-1.5 rounded-full ${c.dot}`} />
                                  {h.purpose}
                                </span>
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600">
                                  {fmtTime(new Date(h.date))}
                                </span>
                              </div>

                              <h4 className="line-clamp-1 text-sm font-bold text-slate-900 transition group-hover:text-sky-600">
                                {h.caseTitle}
                              </h4>
                              <p className="mt-0.5 font-mono text-xs text-slate-500">{h.caseNumber}</p>

                              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-600">
                                <MapPin className="size-3 shrink-0 text-slate-400" />
                                <span className="truncate">{h.court}</span>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                              <span className="truncate text-slate-500">
                                {h.clientName ? `Client: ${h.clientName}` : "Case File"}
                              </span>
                              <span className="inline-flex items-center gap-0.5 font-semibold text-sky-600 group-hover:underline">
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
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Diary Agenda · {MONTHS[month]} {year}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {filtered.length} court appearance{filtered.length !== 1 ? "s" : ""}.
              </p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState month={MONTHS[month]} year={year} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((h) => {
                const c = getPurposeColor(h.purpose);
                const d = new Date(h.date);
                const isToday = isThisMonth && d.getDate() === todayDate;

                return (
                  <div
                    key={h.id}
                    className={`flex flex-col gap-3 p-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between ${
                      isToday ? "bg-sky-50/30" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {/* Date badge */}
                      <div className="flex min-w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-center shadow-2xs">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          {new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d)}
                        </span>
                        <span className="text-lg font-black leading-tight text-slate-800">
                          {d.getDate()}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500">
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
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">
                            <Clock className="size-3 text-slate-400" />
                            {fmtTime(d)}
                          </span>
                          {isToday && (
                            <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                              Today
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/cases/${h.caseId}/hearings`}
                          className="block truncate text-sm font-bold text-slate-900 transition hover:text-sky-600"
                        >
                          {h.caseTitle}
                        </Link>
                        <p className="font-mono text-xs text-slate-500">
                          {h.caseNumber}
                          {h.clientName ? ` · Client: ${h.clientName}` : ""}
                        </p>

                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                          <MapPin className="size-3 shrink-0 text-slate-400" />
                          <span className="truncate">{h.court}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-2 sm:self-center">
                      <button
                        type="button"
                        onClick={() => setActiveHearing(h)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:border-sky-300 hover:text-sky-600"
                      >
                        Quick View
                      </button>
                      <Link
                        href={`/cases/${h.caseId}/hearings`}
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-sky-600"
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
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
                Court Cause List
              </span>
              <h3 className="text-base font-extrabold text-slate-900">
                {fmtDateFull(new Date(year, month, selectedDay))}
              </h3>
            </div>
            <CloseBtn onClick={() => setSelectedDay(null)} />
          </div>

          <div className="space-y-3 overflow-y-auto p-5" style={{ maxHeight: "60vh" }}>
            {dayHearings.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <CalendarIcon className="size-6" />
                </div>
                <p className="text-sm font-bold text-slate-700">No hearings on this day</p>
                <p className="mt-1 text-xs text-slate-500">
                  No court appearances scheduled for this date.
                </p>
              </div>
            ) : (
              dayHearings.map((h) => <HearingCard key={h.id} hearing={h} />)
            )}
          </div>

          <div className="flex justify-end border-t border-slate-200 bg-slate-50/50 px-5 py-3">
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
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
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-4">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
                Hearing Details
              </span>
              <h3 className="max-w-[280px] truncate text-sm font-extrabold text-slate-900">
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
                    <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-700">
                      <Clock className="size-3 text-slate-400" />
                      {fmtTime(new Date(activeHearing.date))}
                    </span>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs">
                    <Field label="Date" value={fmtDateFull(new Date(activeHearing.date))} bold />
                    <Field label="Case Number" value={activeHearing.caseNumber} mono />
                    <Field
                      label="Court Venue"
                      value={activeHearing.court}
                      icon={<MapPin className="size-3.5 text-sky-500" />}
                    />
                    {activeHearing.clientName && (
                      <Field label="Client" value={activeHearing.clientName} />
                    )}
                    {activeHearing.notes && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Notes / Instructions
                        </span>
                        <p className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                          {activeHearing.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-5 py-3">
            <button
              type="button"
              onClick={() => setActiveHearing(null)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              Close
            </button>
            <Link
              href={`/cases/${activeHearing.caseId}/hearings`}
              className="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-sky-600"
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
        className={`appearance-none rounded-xl border border-slate-200 bg-white shadow-xs transition hover:border-sky-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden ${
          small
            ? "py-2 pl-3 pr-7 text-xs font-semibold text-slate-700"
            : "py-1.5 pl-3 pr-8 text-sm font-bold text-slate-800"
        }`}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
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
      className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
    >
      <X className="size-4" />
    </button>
  );
}

function HearingCard({ hearing: h }: { hearing: CalendarHearing }) {
  const c = getPurposeColor(h.purpose);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-sky-300">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold ${c.bg} ${c.text} ${c.border}`}
        >
          <span className={`size-1.5 rounded-full ${c.dot}`} />
          {h.purpose}
        </span>
        <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
          <Clock className="size-3 text-slate-400" />
          {fmtTime(new Date(h.date))}
        </span>
      </div>

      <h4 className="text-sm font-extrabold text-slate-900">{h.caseTitle}</h4>
      <p className="mt-0.5 font-mono text-xs text-slate-500">{h.caseNumber}</p>

      <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Building2 className="size-3.5 shrink-0 text-slate-400" />
          <span className="font-semibold text-slate-800">{h.court}</span>
        </div>
        {h.clientName && (
          <div className="flex items-center gap-2">
            <User className="size-3.5 shrink-0 text-slate-400" />
            <span>Client: {h.clientName}</span>
          </div>
        )}
        {h.notes && (
          <div className="flex items-start gap-2 border-t border-slate-200/60 pt-1">
            <FileText className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
            <p className="italic text-slate-600">{h.notes}</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Link
          href={`/cases/${h.caseId}/hearings`}
          className="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-sky-600"
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
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <p
        className={`mt-0.5 flex items-center gap-1.5 ${
          bold ? "text-sm font-bold text-slate-800" : "text-xs font-semibold text-slate-800"
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
      <CalendarIcon className="mb-2 size-10 text-slate-300" />
      <p className="text-sm font-bold text-slate-700">No hearings found</p>
      <p className="mt-1 max-w-xs text-xs text-slate-500">
        No hearings matched your filter for {month} {year}.
      </p>
    </div>
  );
}
