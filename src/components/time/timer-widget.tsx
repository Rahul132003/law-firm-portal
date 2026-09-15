"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { buttonClass } from "@/components/ui/button";
import type { TimeActivity } from "@/generated/prisma/enums";
import { discardTimer, startTimer, stopTimer } from "@/lib/time-tracking/actions";
import { TIME_ACTIVITY_LABELS, TIME_ACTIVITY_ORDER } from "@/lib/time-tracking/rules";

export type CaseOption = { id: string; caseNumber: string; title: string };

export type RunningTimerView = {
  startedAtMs: number;
  caseLabel: string | null;
  activity: TimeActivity;
  description: string;
};

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Live h:mm:ss since `startedAtMs`. `initialNowMs` keeps SSR and hydration equal. */
export function useElapsed(startedAtMs: number | null, initialNowMs: number): string {
  const [now, setNow] = useState(initialNowMs);
  useEffect(() => {
    if (startedAtMs === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAtMs]);
  return startedAtMs === null ? "0:00:00" : clock(now - startedAtMs);
}

export function TimerWidget({
  timer,
  cases,
  nowMs,
  defaultCaseId = "",
}: {
  timer: RunningTimerView | null;
  cases: CaseOption[];
  nowMs: number;
  defaultCaseId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const elapsed = useElapsed(timer?.startedAtMs ?? null, nowMs);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.message ? { text: result.message, ok: result.ok } : null);
      router.refresh();
    });
  }

  if (timer) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-4 border-accent-600/40 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent-700">
            <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-danger" />
            Timer running
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-primary" aria-live="off">
            {elapsed}
          </p>
          <p className="mt-0.5 truncate text-sm text-secondary">
            {TIME_ACTIVITY_LABELS[timer.activity]}
            {timer.caseLabel ? ` · ${timer.caseLabel}` : " · Firm work"}
            {timer.description ? ` — ${timer.description}` : ""}
          </p>
          {message ? (
            <p role="status" className={`mt-1 text-xs ${message.ok ? "text-success" : "text-danger"}`}>
              {message.text}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={pending} onClick={() => run(stopTimer)} className={buttonClass("primary", "sm")}>
            Stop &amp; record
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Discard this timer without recording any time?")) run(discardTimer);
            }}
            className={buttonClass("secondary", "sm")}
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        run(() =>
          startTimer({
            caseId: String(form.get("caseId") ?? ""),
            activity: String(form.get("activity") ?? "OTHER"),
            description: String(form.get("description") ?? ""),
          }),
        );
      }}
      className="card p-4"
    >
      <p className="text-sm font-semibold text-primary">Start a timer</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-end">
        <div>
          <label htmlFor="timer-case" className="field-label">Case</label>
          <select id="timer-case" name="caseId" defaultValue={defaultCaseId} className="field-input cursor-pointer">
            <option value="">Firm work (no case)</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.caseNumber} — {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="timer-activity" className="field-label">Activity</label>
          <select id="timer-activity" name="activity" defaultValue="DRAFTING" className="field-input cursor-pointer">
            {TIME_ACTIVITY_ORDER.map((a) => (
              <option key={a} value={a}>{TIME_ACTIVITY_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="timer-description" className="field-label">What are you working on?</label>
          <input id="timer-description" name="description" maxLength={1000} className="field-input" placeholder="e.g. Reply to interim application" />
        </div>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Starting…" : "Start"}
        </button>
      </div>
      {message ? (
        <p role="status" className={`mt-2 text-xs ${message.ok ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
