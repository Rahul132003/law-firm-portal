"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { TimeActivity } from "@/generated/prisma/enums";
import { deleteTimeEntry } from "@/lib/time-tracking/actions";
import { TIME_ACTIVITY_LABELS, formatMinutes } from "@/lib/time-tracking/rules";
import { TimeEntryForm } from "./time-entry-form";
import type { CaseOption } from "./timer-widget";

export type EntryView = {
  id: string;
  workDate: string;
  minutes: number;
  activity: TimeActivity;
  description: string;
  caseId: string | null;
  case: { id: string; caseNumber: string; title: string } | null;
};

export type DayGroup = { day: string; label: string; entries: EntryView[] };

function toDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export function EntryList({
  groups,
  cases,
  maxDate,
  canEdit,
  canDelete,
}: {
  groups: DayGroup[];
  cases: CaseOption[];
  maxDate: string;
  /** Only the owner edits their own entries. */
  canEdit: boolean;
  /** The owner, or a partner making a correction. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      {groups.map((group) => {
        const total = group.entries.reduce((sum, e) => sum + e.minutes, 0);
        return (
          <section key={group.day}>
            <h3 className="mb-2 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-muted">
              <span>{group.label}</span>
              <span className="font-mono normal-case tracking-normal text-secondary">{formatMinutes(total)}</span>
            </h3>
            <ul className="card divide-y divide-hairline">
              {group.entries.map((entry) =>
                editing === entry.id ? (
                  <li key={entry.id} className="p-4">
                    <TimeEntryForm
                      entryId={entry.id}
                      cases={cases}
                      maxDate={maxDate}
                      onDone={() => setEditing(null)}
                      defaults={{
                        caseId: entry.caseId ?? "",
                        workDate: entry.workDate,
                        duration: toDuration(entry.minutes),
                        activity: entry.activity,
                        description: entry.description,
                      }}
                    />
                  </li>
                ) : (
                  <li key={entry.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <span className="w-16 shrink-0 font-mono text-sm tabular-nums text-primary">{formatMinutes(entry.minutes)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-primary">{entry.description}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {TIME_ACTIVITY_LABELS[entry.activity]} ·{" "}
                        {entry.case ? (
                          <Link href={`/cases/${entry.case.id}/time`} className="hover:underline">
                            {entry.case.caseNumber} — {entry.case.title}
                          </Link>
                        ) : (
                          "Firm work"
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit ? (
                        <button type="button" onClick={() => setEditing(entry.id)} className="rounded-md border border-hairline px-2 py-1 text-[11px] text-secondary hover:bg-sunken">
                          Edit
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (!window.confirm("Delete this time entry?")) return;
                            startTransition(async () => {
                              const result = await deleteTimeEntry(entry.id);
                              setError(result.ok ? null : (result.message ?? "Could not delete."));
                              router.refresh();
                            });
                          }}
                          className="rounded-md border border-hairline px-2 py-1 text-[11px] text-danger hover:bg-danger-soft"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </li>
                ),
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
