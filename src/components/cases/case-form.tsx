"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { CaseRole } from "@/generated/prisma/enums";
import { buttonClass } from "@/components/ui/button";
import type { CaseFormState } from "@/lib/cases/actions";
import {
  CASE_ROLE_LABELS,
  CASE_ROLE_ORDER,
  CASE_STATUS_LABELS,
  CASE_STATUS_ORDER,
  CASE_TYPE_LABELS,
  CASE_TYPE_ORDER,
} from "@/lib/cases/labels";

type StaffOption = { id: string; name: string; role: string };

export type CaseFormDefaults = {
  caseNumber: string;
  title: string;
  clientName: string;
  caseType: string;
  court: string;
  jurisdiction: string;
  judge: string;
  opposingParty: string;
  opposingCounsel: string;
  status: string;
  filedOn: string;
  assignments: Array<{ userId: string; roleOnCase: CaseRole }>;
};

const EMPTY: CaseFormState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-danger">{message}</p>;
}

export function CaseForm({
  action,
  staff,
  defaults,
  submitLabel,
  cancelHref,
}: {
  action: (state: CaseFormState, formData: FormData) => Promise<CaseFormState>;
  staff: StaffOption[];
  defaults: CaseFormDefaults;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY);
  const [assignments, setAssignments] = useState(defaults.assignments);

  const errors = state.errors ?? {};
  const unassigned = staff.filter(
    (person) => !assignments.some((entry) => entry.userId === person.id),
  );

  function addAssignment(userId: string) {
    if (!userId) return;
    setAssignments((current) => [
      ...current,
      { userId, roleOnCase: "SUPPORTING_ADVOCATE" as CaseRole },
    ]);
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <section className="card p-6">
        {" "}
        <h2 className="mb-4 text-sm font-semibold text-primary">
          Matter details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="caseNumber" className="field-label">
              Case number
            </label>
            <input
              id="caseNumber"
              name="caseNumber"
              defaultValue={defaults.caseNumber}
              required
              className="field-input font-mono"
              placeholder="CS/1234/2026"
            />
            <FieldError message={errors.caseNumber} />
          </div>

          <div>
            <label htmlFor="caseType" className="field-label">
              Case type
            </label>
            <select
              id="caseType"
              name="caseType"
              defaultValue={defaults.caseType}
              className="field-input cursor-pointer"
            >
              {CASE_TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {CASE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <FieldError message={errors.caseType} />
          </div>

          <div className="sm:col-span-2">
            {" "}
            <label htmlFor="title" className="field-label">
              Title
            </label>
            <input
              id="title"
              name="title"
              defaultValue={defaults.title}
              required
              className="field-input"
              placeholder="Sharma v. Metro Developments Ltd."
            />
            <FieldError message={errors.title} />
          </div>

          <div>
            <label htmlFor="clientName" className="field-label">
              Client
            </label>
            <input
              id="clientName"
              name="clientName"
              defaultValue={defaults.clientName}
              required
              className="field-input"
            />
            <FieldError message={errors.clientName} />
          </div>

          <div>
            <label htmlFor="status" className="field-label">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={defaults.status}
              className="field-input cursor-pointer"
            >
              {CASE_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {CASE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <FieldError message={errors.status} />
          </div>
        </div>
      </section>

      <section className="card p-6">
        {" "}
        <h2 className="mb-4 text-sm font-semibold text-primary">
          Forum and parties
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="court" className="field-label">
              Court
            </label>
            <input
              id="court"
              name="court"
              defaultValue={defaults.court}
              required
              className="field-input"
              placeholder="High Court of Delhi"
            />
            <FieldError message={errors.court} />
          </div>

          <div>
            <label htmlFor="jurisdiction" className="field-label">
              Jurisdiction
            </label>
            <input
              id="jurisdiction"
              name="jurisdiction"
              defaultValue={defaults.jurisdiction}
              required
              className="field-input"
              placeholder="New Delhi"
            />
            <FieldError message={errors.jurisdiction} />
          </div>

          <div>
            <label htmlFor="judge" className="field-label">
              {" "}
              Judge <span className="text-muted">(optional)</span>
            </label>
            <input
              id="judge"
              name="judge"
              defaultValue={defaults.judge}
              className="field-input"
            />
            <FieldError message={errors.judge} />
          </div>

          <div>
            <label htmlFor="filedOn" className="field-label">
              {" "}
              Filed on <span className="text-muted">(optional)</span>
            </label>
            <input
              id="filedOn"
              name="filedOn"
              type="date"
              defaultValue={defaults.filedOn}
              className="field-input"
            />
            <FieldError message={errors.filedOn} />
          </div>

          <div>
            <label htmlFor="opposingParty" className="field-label">
              {" "}
              Opposing party <span className="text-muted">(optional)</span>
            </label>
            <input
              id="opposingParty"
              name="opposingParty"
              defaultValue={defaults.opposingParty}
              className="field-input"
            />
            <FieldError message={errors.opposingParty} />
          </div>

          <div>
            <label htmlFor="opposingCounsel" className="field-label">
              {" "}
              Opposing counsel <span className="text-muted">(optional)</span>
            </label>
            <input
              id="opposingCounsel"
              name="opposingCounsel"
              defaultValue={defaults.opposingCounsel}
              className="field-input"
            />
            <FieldError message={errors.opposingCounsel} />
          </div>
        </div>
      </section>

      <section className="card p-6">
        {" "}
        <h2 className="text-sm font-semibold text-primary">
          Assigned team
        </h2>{" "}
        <p className="mt-1 mb-4 text-xs text-secondary">
          Only assigned staff can open this case. Leave empty and you will be
          added as lead counsel.
        </p>
        {assignments.length > 0 ? (
          <ul className="mb-4 space-y-2">
            {assignments.map((entry, index) => {
              const person = staff.find((s) => s.id === entry.userId);
              return (
                <li
                  key={entry.userId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline px-3 py-2"
                >
                  {/* Encoded as userId:roleOnCase and parsed server-side. */}
                  <input
                    type="hidden"
                    name="assignment"
                    value={`${entry.userId}:${entry.roleOnCase}`}
                  />
                  <span className="flex-1 text-sm text-primary">
                    {" "}
                    {person?.name ?? "Unknown user"}
                  </span>

                  <label className="text-xs">
                    {" "}
                    <span className="sr-only">
                      {" "}
                      Role for {person?.name ?? "this person"}
                    </span>
                    <select
                      value={entry.roleOnCase}
                      onChange={(event) =>
                        setAssignments((current) =>
                          current.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  roleOnCase: event.target.value as CaseRole,
                                }
                              : item,
                          ),
                        )
                      }
                      className="cursor-pointer rounded-md border border-hairline bg-raised px-2 py-1 text-xs text-secondary"
                    >
                      {CASE_ROLE_ORDER.map((role) => (
                        <option key={role} value={role}>
                          {CASE_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setAssignments((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    className="text-xs font-medium text-danger hover:underline"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <label className="block">
          {" "}
          <span className="sr-only">Add a team member</span>
          <select
            value=""
            onChange={(event) => addAssignment(event.target.value)}
            disabled={unassigned.length === 0}
            className="field-input max-w-sm cursor-pointer"
          >
            <option value="">
              {unassigned.length === 0
                ? "Everyone is already assigned"
                : "Add a team member…"}
            </option>
            {unassigned.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <FieldError message={errors.assignments} />
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary")}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={cancelHref} className={buttonClass("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
