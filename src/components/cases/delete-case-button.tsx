"use client";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { deleteCase } from "@/lib/cases/actions";

/**
 * Two-step delete. Cascading a case removes its documents, hearings, tasks
 * and notes, so a single click is too easy.
 */
export function DeleteCaseButton({
  caseId,
  caseTitle,
}: {
  caseId: string;
  caseTitle: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={buttonClass("danger", "sm")}
      >
        Delete
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-2 py-1">
      {" "}
      <span className="text-xs text-danger">
        Delete “{caseTitle}” and everything on it?
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteCase(caseId))}
        className="text-xs font-semibold text-danger underline disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-danger/80 hover:underline"
      >
        Cancel
      </button>
    </span>
  );
}
