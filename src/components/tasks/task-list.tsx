"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TaskKind, TaskStatus } from "@/generated/prisma/enums";
import { deleteTask, setTaskStatus } from "@/lib/tasks/actions";
import {
  TASK_KIND_LABELS,
  TASK_KIND_STYLES,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  TASK_STATUS_STYLES,
  isDeadline,
} from "@/lib/tasks/constants";
import { TaskForm, type TaskDefaults } from "./task-form";

export type TaskRow = {
  id: string;
  description: string;
  dueDate: Date;
  status: TaskStatus;
  kind: TaskKind;
  assignedTo: { id: string; name: string };
  createdBy: { id: string; name: string } | null;
  caseRef: { id: string; caseNumber: string; title: string } | null;
};

type Option = { id: string; label: string };

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

/** Days remaining, rendered as a human phrase with urgency styling. */
function dueLabel(dueDate: Date, nowMs: number, status: TaskStatus) {
  if (status === "DONE") {
    return { text: formatDate(dueDate), tone: "text-muted" };
  }

  const days = Math.ceil((dueDate.getTime() - nowMs) / 86_400_000);

  if (days < 0) {
    return {
      text: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`,
      tone: "text-red-700 font-medium",
    };
  }
  if (days === 0)
    return { text: "Due today", tone: "text-red-700 font-medium" };
  if (days === 1)
    return { text: "Due tomorrow", tone: "text-orange-700 font-medium" };
  if (days <= 7)
    return { text: `Due in ${days} days`, tone: "text-orange-700" };
  return { text: `Due ${formatDate(dueDate)}`, tone: "text-secondary" };
}

export function TaskList({
  tasks,
  nowMs,
  currentUserId,
  isAdminViewer,
  staff,
  cases,
  canAssignOthers,
  showCase = true,
  lockedCaseId,
}: {
  tasks: TaskRow[];
  /** Server render time; keeps "overdue by N days" stable across hydration. */
  nowMs: number;
  currentUserId: string;
  isAdminViewer: boolean;
  staff: Option[];
  cases: Option[];
  canAssignOthers: boolean;
  showCase?: boolean;
  lockedCaseId?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (tasks.length === 0) {
    return (
      <p className="card px-6 py-10 text-center text-sm text-muted">
        Nothing here.
      </p>
    );
  }

  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {tasks.map((task) => {
          if (editing === task.id) {
            const defaults: TaskDefaults = {
              id: task.id,
              description: task.description,
              assignedToId: task.assignedTo.id,
              caseId: task.caseRef?.id ?? "",
              dueDate: task.dueDate.toISOString().slice(0, 10),
              status: task.status,
              kind: task.kind,
            };

            return (
              <li key={task.id}>
                <TaskForm
                  defaults={defaults}
                  staff={staff}
                  cases={cases}
                  canAssignOthers={canAssignOthers}
                  currentUserId={currentUserId}
                  lockedCaseId={lockedCaseId}
                  onDone={() => {
                    setEditing(null);
                    router.refresh();
                  }}
                />
              </li>
            );
          }

          const due = dueLabel(task.dueDate, nowMs, task.status);
          const mayChange =
            task.assignedTo.id === currentUserId ||
            task.createdBy?.id === currentUserId ||
            isAdminViewer;

          return (
            <li
              key={task.id}
              className={`card p-4 ${task.status === "DONE" ? "opacity-70" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                {" "}
                <div className="min-w-0 flex-1">
                  {" "}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${TASK_STATUS_STYLES[task.status]}`}
                    >
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                    {isDeadline(task.kind) ? (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${TASK_KIND_STYLES[task.kind]}`}
                      >
                        {TASK_KIND_LABELS[task.kind]}
                      </span>
                    ) : null}
                    <span className={`text-[11px] ${due.tone}`}>
                      {due.text}
                    </span>
                  </div>
                  <p
                    className={`mt-1.5 text-sm ${task.status === "DONE" ? "text-secondary line-through" : "text-primary"}`}
                  >
                    {task.description}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {task.assignedTo.name}
                    {showCase && task.caseRef ? (
                      <>
                        {" · "}
                        <Link
                          href={`/cases/${task.caseRef.id}/tasks`}
                          className="underline-offset-2 hover:underline"
                        >
                          {task.caseRef.caseNumber}
                        </Link>
                      </>
                    ) : null}
                    {showCase && !task.caseRef ? " · Personal" : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {mayChange ? (
                    <label className="text-xs">
                      {" "}
                      <span className="sr-only">Status for this task</span>
                      <select
                        value={task.status}
                        disabled={pending}
                        onChange={(event) => {
                          const next = event.target.value;
                          startTransition(async () => {
                            const result = await setTaskStatus(task.id, next);
                            if (!result.ok) {
                              setError(result.message ?? "Could not update.");
                            } else {
                              setError(null);
                              router.refresh();
                            }
                          });
                        }}
                        className="cursor-pointer rounded-md border border-hairline bg-raised px-1.5 py-1 text-xs text-secondary"
                      >
                        {TASK_STATUS_ORDER.map((status) => (
                          <option key={status} value={status}>
                            {TASK_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {mayChange ? (
                    <button
                      type="button"
                      onClick={() => setEditing(task.id)}
                      className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken hover:text-primary"
                    >
                      Edit
                    </button>
                  ) : null}

                  {mayChange ? (
                    confirming === task.id ? (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await deleteTask(task.id);
                              setConfirming(null);
                              if (!result.ok) {
                                setError(result.message ?? "Could not delete.");
                              } else {
                                router.refresh();
                              }
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
                        onClick={() => setConfirming(task.id)}
                        className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:border-red-300 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
