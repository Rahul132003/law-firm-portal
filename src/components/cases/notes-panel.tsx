"use client";
import { useActionState, useRef, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import type { NoteVisibility } from "@/generated/prisma/enums";
import {
  addCaseNote,
  deleteCaseNote,
  type NoteFormState,
} from "@/lib/cases/actions";

const EMPTY: NoteFormState = {};

export type NoteView = {
  id: string;
  body: string;
  visibility: NoteVisibility;
  createdAt: Date;
  author: { id: string; name: string };
  canDelete: boolean;
};

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function NoteComposer({
  caseId,
  canWriteStrategy,
}: {
  caseId: string;
  canWriteStrategy: boolean;
}) {
  const action = addCaseNote.bind(null, caseId);
  const [state, formAction, pending] = useActionState(action, EMPTY);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="card p-4"
    >
      <label htmlFor="note-body" className="field-label">
        Add a note
      </label>
      <textarea
        id="note-body"
        name="body"
        rows={3}
        required
        disabled={pending}
        placeholder="Observations, instructions, next steps…"
        className="field-input resize-y"
      />
      {state.errors?.body ? (
        <p className="mt-1 text-xs text-red-700">{state.errors.body}</p>
      ) : null}

      {state.message ? (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {state.message}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {canWriteStrategy ? (
          <label className="flex items-center gap-2 text-xs text-secondary">
            <select
              name="visibility"
              defaultValue="CASE_TEAM"
              className="cursor-pointer rounded-md border border-hairline bg-raised px-2 py-1 text-xs"
            >
              <option value="CASE_TEAM">Visible to the case team</option>{" "}
              <option value="STRATEGY">
                Strategy — hidden from paralegals
              </option>
            </select>
          </label>
        ) : (
          // Paralegals may only ever post case-team notes.
          <input type="hidden" name="visibility" value="CASE_TEAM" />
        )}

        <button
          type="submit"
          disabled={pending}
          className={`${buttonClass("primary", "sm")} ml-auto`}
        >
          {pending ? "Saving…" : "Post note"}
        </button>
      </div>
    </form>
  );
}

export function NoteList({ notes }: { notes: NoteView[] }) {
  const [pending, startTransition] = useTransition();

  if (notes.length === 0) {
    return (
      <p className="card px-6 py-10 text-center text-sm text-muted">
        No notes on this case yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li key={note.id} className="card p-4">
          {" "}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {" "}
            <span className="text-sm font-medium text-primary">
              {note.author.name}
            </span>
            <span className="text-xs text-muted">
              {formatTimestamp(note.createdAt)}
            </span>
            {note.visibility === "STRATEGY" ? (
              <span className="rounded-full border border-brass-300 bg-brass-50 px-2 py-0.5 text-[11px] font-medium text-brass-800">
                Strategy
              </span>
            ) : null}
            {note.canDelete ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => deleteCaseNote(note.id))}
                className="ml-auto text-xs text-secondary hover:text-red-700 disabled:opacity-60"
              >
                Delete
              </button>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap text-sm text-secondary">
            {note.body}
          </p>
        </li>
      ))}
    </ul>
  );
}
