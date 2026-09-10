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
  // Deadlines keep a tint because urgency is the point; ordinary work stays
  // neutral so the two deadline kinds actually stand out.
  GENERAL: "bg-sunken text-secondary",
  FILING_DEADLINE: "border border-warning/30 bg-warning-soft text-warning",
  LIMITATION_DEADLINE: "border border-danger/30 bg-danger-soft text-danger",
};

export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  TODO: "bg-sunken text-secondary",
  IN_PROGRESS: "bg-accent-50 text-accent-800",
  BLOCKED: "bg-danger-soft text-danger",
  DONE: "bg-success-soft text-success",
};

export function isDeadline(kind: TaskKind): boolean {
  return kind !== "GENERAL";
}
