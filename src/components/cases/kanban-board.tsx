"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import type { CaseStatus } from "@/generated/prisma/enums";
import { updateCaseStatus } from "@/lib/cases/actions";
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_ORDER,
  CASE_STATUS_STYLES,
} from "@/lib/cases/labels";
import type { CaseSummary } from "@/lib/cases/queries";
import { TypeBadge } from "./status-badge";

type Board = Record<CaseStatus, CaseSummary[]>;
type Move = { caseId: string; to: CaseStatus };

function applyMove(board: Board, move: Move): Board {
  let moving: CaseSummary | undefined;

  const next = {} as Board;
  for (const status of CASE_STATUS_ORDER) {
    next[status] = board[status].filter((record) => {
      if (record.id === move.caseId) {
        moving = record;
        return false;
      }
      return true;
    });
  }

  if (moving) {
    next[move.to] = [{ ...moving, status: move.to }, ...next[move.to]];
  }

  return next;
}

export function KanbanBoard({
  grouped,
  canEdit,
}: {
  grouped: Board;
  canEdit: boolean;
}) {
  // Optimistic so a drag lands instantly; the server action revalidates and
  // the real data replaces this on the next render.
  const [board, moveCard] = useOptimistic(grouped, applyMove);
  const [, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState<CaseStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  function move(caseId: string, to: CaseStatus, from: CaseStatus) {
    if (!canEdit || to === from) return;

    startTransition(async () => {
      moveCard({ caseId, to });
      const result = await updateCaseStatus(caseId, to);
      if (!result.ok) {
        setError(result.message ?? "Could not move that case.");
      }
    });
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

      <div className="flex gap-4 overflow-x-auto pb-4">
        {CASE_STATUS_ORDER.map((status) => {
          const column = board[status];
          const style = CASE_STATUS_STYLES[status];

          return (
            <section
              key={status}
              aria-label={CASE_STATUS_LABELS[status]}
              onDragOver={(event) => {
                if (!canEdit) return;
                event.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(null);
                const caseId = event.dataTransfer.getData("text/case-id");
                const from = event.dataTransfer.getData(
                  "text/case-status",
                ) as CaseStatus;
                if (caseId) move(caseId, status, from);
              }}
              className={`flex w-72 shrink-0 flex-col rounded-xl border border-t-2 border-hairline bg-sunken/60 ${style.column} ${
                dragOver === status ? "ring-2 ring-brass-400" : ""
              }`}
            >
              <header className="flex items-center justify-between px-3 py-2.5">
                {" "}
                <h3 className="text-sm font-semibold text-primary">
                  {CASE_STATUS_LABELS[status]}
                </h3>
                <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-medium text-secondary">
                  {column.length}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-2 px-2 pb-3">
                {column.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted">
                    Nothing here
                  </p>
                ) : (
                  column.map((record) => (
                    <article
                      key={record.id}
                      draggable={canEdit}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/case-id", record.id);
                        event.dataTransfer.setData(
                          "text/case-status",
                          record.status,
                        );
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      className={`card p-3 ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      <Link
                        href={`/cases/${record.id}`}
                        className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {record.title}
                      </Link>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {" "}
                        <span className="font-mono text-[11px] text-muted">
                          {record.caseNumber}
                        </span>
                        <TypeBadge caseType={record.caseType} />
                      </div>

                      <p className="mt-2 truncate text-xs text-secondary">
                        {record.clientName}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {record.court}
                      </p>

                      {canEdit ? (
                        <label className="mt-2.5 block">
                          {/* Keyboard-accessible equivalent of dragging. */}
                          <span className="sr-only">
                            Move {record.title} to another status
                          </span>
                          <select
                            value={record.status}
                            onChange={(event) =>
                              move(
                                record.id,
                                event.target.value as CaseStatus,
                                record.status,
                              )
                            }
                            className="w-full cursor-pointer rounded-md border border-hairline bg-raised px-1.5 py-1 text-[11px] text-secondary"
                          >
                            {CASE_STATUS_ORDER.map((option) => (
                              <option key={option} value={option}>
                                Move to {CASE_STATUS_LABELS[option]}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
