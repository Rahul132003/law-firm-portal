import type { TaskKind, TaskStatus } from "@/generated/prisma/enums";

/** Client-safe display metadata for tasks. */

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export const TASK_STATUS_ORDER: readonly TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
] as const;

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  GENERAL: "General task",
  FILING_DEADLINE: "Filing deadline",
  LIMITATION_DEADLINE: "Limitation deadline",
};

export const TASK_KIND_ORDER: readonly TaskKind[] = [
  "GENERAL",
  "FILING_DEADLINE",
  "LIMITATION_DEADLINE",
] as const;

/** Deadlines are visually distinct from ordinary work items. */
export const TASK_KIND_STYLES: Record<TaskKind, string> = {
  GENERAL: "bg-sunken text-secondary",
  FILING_DEADLINE: "bg-orange-50 text-orange-800 border border-orange-200",
  LIMITATION_DEADLINE: "bg-red-50 text-red-800 border border-red-200",
};

export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  TODO: "bg-ink-100 text-ink-700",
  IN_PROGRESS: "bg-brass-50 text-brass-800",
  BLOCKED: "bg-red-50 text-red-800",
  DONE: "bg-emerald-50 text-emerald-800",
};

export function isDeadline(kind: TaskKind): boolean {
  return kind !== "GENERAL";
}
