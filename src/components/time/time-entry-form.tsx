"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonClass } from "@/components/ui/button";
import type { TimeActivity } from "@/generated/prisma/enums";
import {
  createTimeEntry,
  updateTimeEntry,
  type TimeFormState,
} from "@/lib/time-tracking/actions";
import { TIME_ACTIVITY_LABELS, TIME_ACTIVITY_ORDER } from "@/lib/time-tracking/rules";
import type { CaseOption } from "./timer-widget";

export type EntryDefaults = {
  caseId: string;
  workDate: string;
  duration: string;
  activity: TimeActivity;
  description: string;
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-danger">{message}</p> : null;
}

export function TimeEntryForm({
  cases,
  defaults,
  maxDate,
  entryId,
  onDone,
}: {
  cases: CaseOption[];
  defaults: EntryDefaults;
  /** Latest selectable day (today in the firm's time zone). */
  maxDate: string;
  /** Present when editing an existing entry. */
  entryId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<TimeFormState>({});
  const [pending, startTransition] = useTransition();
  const errors = state.errors ?? {};
  const idPrefix = entryId ? `edit-${entryId}` : "new-entry";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = entryId
            ? await updateTimeEntry(entryId, {}, formData)
            : await createTimeEntry({}, formData);
          setState(result);
          if (result.ok) {
            if (!entryId) {
              // Keep case, date and activity for the next entry; clear the rest.
              (form.elements.namedItem("duration") as HTMLInputElement).value = "";
              (form.elements.namedItem("description") as HTMLTextAreaElement).value = "";
            }
            onDone?.();
            router.refresh();
          }
        });
      }}
      className="grid gap-3 sm:grid-cols-6"
    >
      <div className="sm:col-span-3">
        <label htmlFor={`${idPrefix}-case`} className="field-label">Case</label>
        <select id={`${idPrefix}-case`} name="caseId" defaultValue={defaults.caseId} className="field-input cursor-pointer">
          <option value="">Firm work (no case)</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.caseNumber} — {c.title}
            </option>
          ))}
        </select>
        <FieldError message={errors.caseId} />
      </div>

      <div className="sm:col-span-1">
        <label htmlFor={`${idPrefix}-date`} className="field-label">Date</label>
        <input id={`${idPrefix}-date`} name="workDate" type="date" required max={maxDate} defaultValue={defaults.workDate} className="field-input" />
        <FieldError message={errors.workDate} />
      </div>

      <div className="sm:col-span-1">
        <label htmlFor={`${idPrefix}-duration`} className="field-label">Duration</label>
        <input
          id={`${idPrefix}-duration`}
          name="duration"
          required
          inputMode="decimal"
          defaultValue={defaults.duration}
          placeholder="1:30"
          className="field-input"
          aria-describedby={`${idPrefix}-duration-hint`}
        />
        <p id={`${idPrefix}-duration-hint`} className="mt-1 text-[11px] text-muted">1:30, 1.5 or 45m</p>
        <FieldError message={errors.duration} />
      </div>

      <div className="sm:col-span-1">
        <label htmlFor={`${idPrefix}-activity`} className="field-label">Activity</label>
        <select id={`${idPrefix}-activity`} name="activity" defaultValue={defaults.activity} className="field-input cursor-pointer">
          {TIME_ACTIVITY_ORDER.map((a) => (
            <option key={a} value={a}>{TIME_ACTIVITY_LABELS[a]}</option>
          ))}
        </select>
        <FieldError message={errors.activity} />
      </div>

      <div className="sm:col-span-6">
        <label htmlFor={`${idPrefix}-description`} className="field-label">Description</label>
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          required
          rows={2}
          maxLength={1000}
          defaultValue={defaults.description}
          className="field-input"
          placeholder="What was done"
        />
        <FieldError message={errors.description} />
      </div>

      <div className="flex items-center gap-3 sm:col-span-6">
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          {pending ? "Saving…" : entryId ? "Save" : "Add time"}
        </button>
        {onDone && entryId ? (
          <button type="button" onClick={onDone} className={buttonClass("secondary", "sm")}>Cancel</button>
        ) : null}
        {state.message ? (
          <span role="status" className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
