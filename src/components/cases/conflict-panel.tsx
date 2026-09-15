"use client";
import Link from "next/link";
import type { ConflictPreview, VisibleConflict } from "@/lib/conflicts/check";
import { MIN_WAIVER_REASON } from "@/lib/conflicts/waiver";
import { CASE_STATUS_LABELS } from "@/lib/cases/labels";
import type { CaseStatus } from "@/generated/prisma/enums";

function MatchRow({ match }: { match: VisibleConflict }) {
  const status = CASE_STATUS_LABELS[match.status as CaseStatus] ?? match.status;

  return (
    <li className="rounded-lg border border-hairline bg-raised px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {match.caseId ? (
          <Link
            href={`/cases/${match.caseId}`}
            target="_blank"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {match.title}
          </Link>
        ) : (
          <span className="font-medium text-primary">A matter outside your access</span>
        )}
        {match.caseNumber ? (
          <span className="font-mono text-xs text-muted">{match.caseNumber}</span>
        ) : null}
        <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] text-secondary">{status}</span>
        {match.strength === "partial" ? (
          <span className="text-[11px] text-muted">similar name</span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-secondary">{match.reason}</p>
      {!match.caseId ? (
        <p className="mt-1 text-xs text-muted">Ask a partner to review this matter with you.</p>
      ) : null}
    </li>
  );
}

export function ConflictPanel({
  report,
  checking,
  waiverError,
}: {
  report: ConflictPreview | null;
  checking: boolean;
  waiverError?: string;
}) {
  if (!report && !checking) return null;

  const adverse = report?.adverse ?? [];
  const related = report?.related ?? [];

  return (
    <section
      aria-live="polite"
      className={`card p-6 ${adverse.length ? "border-danger/40" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-primary">Conflict of interest check</h2>
        {checking ? <span className="text-xs text-muted">Checking…</span> : null}
      </div>

      {report && adverse.length === 0 && related.length === 0 ? (
        <p className="mt-2 text-sm text-success">
          No matches against the firm&apos;s existing clients or opposing parties.
        </p>
      ) : null}

      {adverse.length > 0 ? (
        <>
          <p className="mt-2 text-sm text-danger">
            {adverse.length === 1
              ? "1 possible conflict found."
              : `${adverse.length} possible conflicts found.`}{" "}
            The firm is, or was, on the other side from one of these parties.
          </p>
          <ul className="mt-3 space-y-2">
            {adverse.map((match, index) => (
              <MatchRow key={`${match.caseId ?? "restricted"}-${index}`} match={match} />
            ))}
          </ul>

          <input type="hidden" name="conflictFingerprint" value={report?.fingerprint ?? ""} />
          <div className="mt-4 rounded-lg border border-hairline bg-sunken/50 p-3">
            <label className="flex items-start gap-2 text-sm text-primary">
              <input type="checkbox" name="conflictAcknowledged" className="mt-1" />
              <span>
                I have reviewed these matches and the firm may act. This is recorded against the
                case with my name.
              </span>
            </label>
            <label htmlFor="waiverReason" className="field-label mt-3">
              Reason
            </label>
            <textarea
              id="waiverReason"
              name="waiverReason"
              rows={3}
              minLength={MIN_WAIVER_REASON}
              className="field-input"
              placeholder="e.g. Different person with the same name — verified by address. / Former client, unrelated matter closed in 2021; written consent on file."
            />
            {waiverError ? <p className="mt-1 text-xs text-danger">{waiverError}</p> : null}
          </div>
        </>
      ) : null}

      {related.length > 0 ? (
        <details className="mt-4" open={adverse.length === 0}>
          <summary className="cursor-pointer text-xs font-medium text-secondary">
            {related.length} related matter{related.length === 1 ? "" : "s"} (same party, same
            side — not a conflict)
          </summary>
          <ul className="mt-2 space-y-2">
            {related.map((match, index) => (
              <MatchRow key={`${match.caseId ?? "restricted"}-${index}`} match={match} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
