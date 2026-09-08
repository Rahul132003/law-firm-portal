import type { CaseStatus, CaseType } from "@/generated/prisma/enums";
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_STYLES,
  CASE_TYPE_LABELS,
} from "@/lib/cases/labels";

export function StatusBadge({ status }: { status: CaseStatus }) {
  const style = CASE_STATUS_STYLES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${style.badge}`}
    >
      <span
        className={`size-1.5 rounded-full ${style.dot}`}
        aria-hidden="true"
      />
      {CASE_STATUS_LABELS[status]}
    </span>
  );
}

export function TypeBadge({ caseType }: { caseType: CaseType }) {
  return (
    <span className="inline-flex items-center rounded-md border border-hairline px-1.5 py-0.5 text-[11px] font-medium text-secondary">
      {CASE_TYPE_LABELS[caseType]}
    </span>
  );
}
