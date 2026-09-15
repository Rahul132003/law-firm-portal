"use client";
import Link from "next/link";

import { useElapsed } from "./timer-widget";

/** Compact running-timer indicator for the top bar, visible on every page. */
export function TimerChip({
  startedAtMs,
  label,
  nowMs,
}: {
  startedAtMs: number;
  label: string;
  nowMs: number;
}) {
  const elapsed = useElapsed(startedAtMs, nowMs);

  return (
    <Link
      href="/time"
      title={`Timer running: ${label}`}
      className="flex items-center gap-2 rounded-full border border-accent-600/40 bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-800 hover:bg-accent-100"
    >
      <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-danger" />
      <span className="font-mono tabular-nums">{elapsed}</span>
      <span className="hidden max-w-40 truncate xl:inline">{label}</span>
      <span className="sr-only">Timer running. Open time tracking.</span>
    </Link>
  );
}
