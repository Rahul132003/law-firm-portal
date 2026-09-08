"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteHearing } from "@/lib/hearings/actions";
import { HearingForm, type HearingDefaults } from "./hearing-form";

export type HearingRow = {
  id: string;
  date: Date;
  court: string;
  purpose: string;
  notes: string;
  nextDate: Date | null;
};

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

/** `datetime-local` needs a local ISO string, not a UTC one. */
function toLocalInput(value: Date | null): string {
  if (!value) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function HearingList({
  caseId,
  hearings,
  canManage,
  defaultCourt,
  nowMs,
}: {
  caseId: string;
  hearings: HearingRow[];
  canManage: boolean;
  defaultCourt: string;
  /** Server render time. Passed in so past/upcoming is computed from a stable
      value rather than an impure Date.now() call during render. */
  nowMs: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (hearings.length === 0) {
    return (
      <p className="card px-6 py-10 text-center text-sm text-muted">
        No hearings recorded on this case yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {hearings.map((hearing) => {
        const isPast = hearing.date.getTime() < nowMs;

        if (editing === hearing.id) {
          const defaults: HearingDefaults = {
            id: hearing.id,
            date: toLocalInput(hearing.date),
            court: hearing.court,
            purpose: hearing.purpose,
            notes: hearing.notes,
            nextDate: toLocalInput(hearing.nextDate),
          };

          return (
            <li key={hearing.id}>
              <HearingForm
                caseId={caseId}
                defaults={defaults}
                defaultCourt={defaultCourt}
                onDone={() => {
                  setEditing(null);
                  router.refresh();
                }}
              />
            </li>
          );
        }

        return (
          <li key={hearing.id} className="card p-4">
            {" "}
            <div className="flex flex-wrap items-start justify-between gap-3">
              {" "}
              <div className="min-w-0 flex-1">
                {" "}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      isPast
                        ? "rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-secondary"
                        : "rounded-full bg-brass-50 px-2 py-0.5 text-[11px] font-medium text-brass-800"
                    }
                  >
                    {isPast ? "Past" : "Upcoming"}
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {formatDateTime(hearing.date)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-secondary">
                  {hearing.purpose}
                </p>
                <p className="text-xs text-muted">{hearing.court}</p>
                {hearing.notes ? (
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-sunken px-3 py-2 text-xs text-secondary">
                    {hearing.notes}
                  </p>
                ) : null}
                {hearing.nextDate ? (
                  <p className="mt-2 text-xs text-secondary">
                    {" "}
                    Next date:{" "}
                    <span className="text-primary">
                      {formatDateTime(hearing.nextDate)}
                    </span>
                  </p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(hearing.id)}
                    className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken hover:text-primary"
                  >
                    Edit
                  </button>

                  {confirming === hearing.id ? (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await deleteHearing(hearing.id);
                            setConfirming(null);
                            router.refresh();
                          })
                        }
                        className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-800"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="text-xs text-secondary hover:underline"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(hearing.id)}
                      className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:border-red-300 hover:text-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
