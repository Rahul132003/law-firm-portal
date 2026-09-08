"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  CASE_STATUS_LABELS,
  CASE_STATUS_ORDER,
  CASE_TYPE_LABELS,
  CASE_TYPE_ORDER,
} from "@/lib/cases/labels";

type StaffOption = { id: string; name: string };

/**
 * Filter state lives in the URL, not component state, so a filtered view is
 * shareable and survives a refresh. Each control pushes a new query string
 * and the server re-queries.
 */
export function CaseFilters({
  courts,
  staff,
  view,
}: {
  courts: string[];
  staff: StaffOption[];
  view: "list" | "board";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const isFirstRender = useRef(true);

  function apply(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function setParam(key: string, value: string) {
    apply((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
  }

  // Debounce the free-text box so typing does not fire a query per keystroke.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) params.set("q", query);
      else params.delete("q");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
    // `searchParams` is intentionally excluded: including it would restart the
    // debounce every time the URL changes, including changes this effect made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, pathname, router]);

  const activeCount = ["status", "caseType", "court", "advocateId", "q"].filter(
    (key) => searchParams.get(key),
  ).length;

  const selectClass = "field-input py-1.5 text-sm max-w-[13rem] cursor-pointer";

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search case no., title, client…"
        aria-label="Search cases"
        className="field-input max-w-xs py-1.5 text-sm"
      />

      {/* On the board, status is the axis of the columns, so hide it. */}
      {view === "list" ? (
        <select
          aria-label="Filter by status"
          className={selectClass}
          value={searchParams.get("status") ?? ""}
          onChange={(event) => setParam("status", event.target.value)}
        >
          <option value="">All statuses</option>
          {CASE_STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {CASE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      ) : null}

      <select
        aria-label="Filter by case type"
        className={selectClass}
        value={searchParams.get("caseType") ?? ""}
        onChange={(event) => setParam("caseType", event.target.value)}
      >
        <option value="">All types</option>
        {CASE_TYPE_ORDER.map((type) => (
          <option key={type} value={type}>
            {CASE_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by court"
        className={selectClass}
        value={searchParams.get("court") ?? ""}
        onChange={(event) => setParam("court", event.target.value)}
      >
        <option value="">All courts</option>
        {courts.map((court) => (
          <option key={court} value={court}>
            {court}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by advocate"
        className={selectClass}
        value={searchParams.get("advocateId") ?? ""}
        onChange={(event) => setParam("advocateId", event.target.value)}
      >
        <option value="">All advocates</option>
        {staff.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            apply((params) => {
              for (const key of [
                "status",
                "caseType",
                "court",
                "advocateId",
                "q",
              ]) {
                params.delete(key);
              }
            });
          }}
          className="text-xs font-medium text-secondary underline underline-offset-2 hover:text-primary"
        >
          Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
        </button>
      ) : null}

      <span
        aria-live="polite"
        className={`ml-auto text-xs ${isPending ? "text-muted" : "sr-only"}`}
      >
        {isPending ? "Updating…" : ""}
      </span>
    </div>
  );
}

/** List / board switch. Preserves the other filters. */
export function ViewToggle({ view }: { view: "list" | "board" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchTo(next: "list" | "board") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "board") params.set("view", "board");
    else params.delete("view");
    // Status is meaningless as a filter once the board groups by it.
    if (next === "board") params.delete("status");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex rounded-lg border border-hairline bg-raised p-0.5"
    >
      {(["list", "board"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={view === mode}
          onClick={() => switchTo(mode)}
          className={
            view === mode
              ? "rounded-md bg-sky-600 text-white font-extrabold px-4 py-1.5 text-sm shadow-sm"
              : "rounded-md px-4 py-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          }
        >
          {mode === "list" ? "List" : "Board"}
        </button>
      ))}
    </div>
  );
}
