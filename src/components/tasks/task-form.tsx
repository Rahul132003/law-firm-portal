"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import {
  createTask,
  updateTask,
  type TaskFormState,
} from "@/lib/tasks/actions";
import {
  TASK_KIND_LABELS,
  TASK_KIND_ORDER,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
} from "@/lib/tasks/constants";

export type TaskDefaults = {
  id?: string;
  description: string;
  assignedToId: string;
  caseId: string;
  dueDate: string;
  status: string;
  kind: string;
};

type Option = { id: string; label: string };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-700">{message}</p>;
}

/**
 * Submits through `useTransition` rather than `useActionState` for the same
 * reason as the hearing form: closing and refreshing on success are submit
 * side effects, not render-time reactions.
 */
export function TaskForm({
  defaults,
  staff,
  cases,
  canAssignOthers,
  currentUserId,
  lockedCaseId,
  onDone,
}: {
  defaults?: TaskDefaults;
  staff: Option[];
  cases: Option[];
  canAssignOthers: boolean;
  currentUserId: string;
  /** Set on a case's Tasks tab, where the case is not a choice. */
  lockedCaseId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<TaskFormState>({});
  const [open, setOpen] = useState(Boolean(defaults?.id));

  const isEdit = Boolean(defaults?.id);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = isEdit
        ? await updateTask(defaults!.id!, {}, formData)
        : await createTask({}, formData);

      if (result.errors || result.message) {
        setState(result);
        return;
      }

      setState({});
      form.reset();
      if (isEdit) onDone?.();
      else setOpen(false);
      router.refresh();
    });
  }

  const errors = state.errors ?? {};

  if (!open && !isEdit) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("primary", "sm")}
      >
        Add a task
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-4">
      {" "}
      <h3 className="text-sm font-semibold text-primary">
        {" "}
        {isEdit ? "Edit task" : "Add a task"}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {" "}
        <div className="sm:col-span-2">
          {" "}
          <label htmlFor="description" className="field-label">
            What needs doing
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            required
            defaultValue={defaults?.description ?? ""}
            disabled={pending}
            placeholder="Draft and file the rejoinder…"
            className="field-input resize-y"
          />
          <FieldError message={errors.description} />
        </div>
        <div>
          <label htmlFor="assignedToId" className="field-label">
            Assigned to
          </label>
          <select
            id="assignedToId"
            name="assignedToId"
            defaultValue={defaults?.assignedToId ?? currentUserId}
            disabled={pending || !canAssignOthers}
            className="field-input cursor-pointer"
          >
            {(canAssignOthers
              ? staff
              : staff.filter((person) => person.id === currentUserId)
            ).map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
          {!canAssignOthers ? (
            // The select is disabled, so its value would not be submitted.
            <input type="hidden" name="assignedToId" value={currentUserId} />
          ) : null}
          <FieldError message={errors.assignedToId} />
        </div>
        <div>
          <label htmlFor="dueDate" className="field-label">
            Due date
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            required
            defaultValue={defaults?.dueDate ?? ""}
            disabled={pending}
            className="field-input"
          />
          <FieldError message={errors.dueDate} />
        </div>
        <div>
          <label htmlFor="kind" className="field-label">
            Type
          </label>
          <select
            id="kind"
            name="kind"
            defaultValue={defaults?.kind ?? "GENERAL"}
            disabled={pending}
            className="field-input cursor-pointer"
          >
            {TASK_KIND_ORDER.map((kind) => (
              <option key={kind} value={kind}>
                {TASK_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Deadlines are alerted earlier — 14 days for filing, 30 for
            limitation.
          </p>
          <FieldError message={errors.kind} />
        </div>
        <div>
          <label htmlFor="status" className="field-label">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaults?.status ?? "TODO"}
            disabled={pending}
            className="field-input cursor-pointer"
          >
            {TASK_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <FieldError message={errors.status} />
        </div>
        {lockedCaseId ? (
          <input type="hidden" name="caseId" value={lockedCaseId} />
        ) : (
          <div className="sm:col-span-2">
            {" "}
            <label htmlFor="caseId" className="field-label">
              {" "}
              Case <span className="text-muted">(optional)</span>
            </label>
            <select
              id="caseId"
              name="caseId"
              defaultValue={defaults?.caseId ?? ""}
              disabled={pending}
              className="field-input cursor-pointer"
            >
              <option value="">No case — personal task</option>
              {cases.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.label}
                </option>
              ))}
            </select>
            <FieldError message={errors.caseId} />
          </div>
        )}
      </div>
      {state.message ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {state.message}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Add task"}
        </button>
        <button
          type="button"
          onClick={() => (isEdit ? onDone?.() : setOpen(false))}
          className={buttonClass("secondary", "sm")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
