"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import {
  createHearing,
  updateHearing,
  type HearingFormState,
} from "@/lib/hearings/actions";

export type HearingDefaults = {
  id?: string;
  date: string;
  court: string;
  purpose: string;
  notes: string;
  nextDate: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-700">{message}</p>;
}

/**
 * Submits through `useTransition` rather than `useActionState`.
 *
 * The post-success behaviour here is to close the form and refresh — side
 * effects that belong in the submit handler. Driving them from an effect that
 * watches a result flag means calling setState during render commit, which
 * React flags as a cascading-render hazard.
 */
export function HearingForm({
  caseId,
  defaults,
  defaultCourt,
  onDone,
}: {
  caseId: string;
  /** Present when editing an existing hearing. */
  defaults?: HearingDefaults;
  /** The case's own court, pre-filled for new hearings. */
  defaultCourt: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<HearingFormState>({});
  const [open, setOpen] = useState(Boolean(defaults?.id));

  const isEdit = Boolean(defaults?.id);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const form = event.currentTarget;

    startTransition(async () => {
      const result = isEdit
        ? await updateHearing(defaults!.id!, {}, formData)
        : await createHearing(caseId, {}, formData);

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
        Record a hearing
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-4">
      {" "}
      <h3 className="text-sm font-semibold text-primary">
        {" "}
        {isEdit ? "Edit hearing" : "Record a hearing"}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="field-label">
            Hearing date
          </label>
          <input
            id="date"
            name="date"
            type="datetime-local"
            required
            defaultValue={defaults?.date ?? ""}
            disabled={pending}
            className="field-input"
          />
          <FieldError message={errors.date} />
        </div>

        <div>
          <label htmlFor="nextDate" className="field-label">
            {" "}
            Next hearing <span className="text-muted">(optional)</span>
          </label>
          <input
            id="nextDate"
            name="nextDate"
            type="datetime-local"
            defaultValue={defaults?.nextDate ?? ""}
            disabled={pending}
            className="field-input"
          />
          <FieldError message={errors.nextDate} />
        </div>

        <div>
          <label htmlFor="court" className="field-label">
            Court
          </label>
          <input
            id="court"
            name="court"
            required
            defaultValue={defaults?.court ?? defaultCourt}
            disabled={pending}
            className="field-input"
          />
          <FieldError message={errors.court} />
        </div>

        <div>
          <label htmlFor="purpose" className="field-label">
            Purpose
          </label>
          <input
            id="purpose"
            name="purpose"
            required
            defaultValue={defaults?.purpose ?? ""}
            placeholder="Framing of issues, final arguments…"
            disabled={pending}
            className="field-input"
          />
          <FieldError message={errors.purpose} />
        </div>

        <div className="sm:col-span-2">
          {" "}
          <label htmlFor="notes" className="field-label">
            {" "}
            Notes <span className="text-muted">(encrypted at rest)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={defaults?.notes ?? ""}
            disabled={pending}
            placeholder="What happened, directions given, what to prepare…"
            className="field-input resize-y"
          />
          <FieldError message={errors.notes} />
        </div>
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
          {pending ? "Saving…" : isEdit ? "Save changes" : "Add hearing"}
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
