import type {
  CaseRole,
  CaseStatus,
  CaseType,
  NoteVisibility,
} from "@/generated/prisma/enums";

/**
 * Display strings and presentation metadata for case enums.
 *
 * Client-safe by design (no `server-only`) — the Kanban board and filter
 * controls are client components and need these.
 */

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  CIVIL: "Civil",
  CRIMINAL: "Criminal",
  CORPORATE: "Corporate",
  FAMILY: "Family",
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  FILED: "Filed",
  UNDER_TRIAL: "Under Trial",
  JUDGMENT: "Judgment",
  APPEAL: "Appeal",
  CLOSED: "Closed",
};

export const CASE_ROLE_LABELS: Record<CaseRole, string> = {
  LEAD_COUNSEL: "Lead Counsel",
  CO_COUNSEL: "Co-Counsel",
  SUPPORTING_ADVOCATE: "Supporting Advocate",
  PARALEGAL: "Paralegal",
};

export const NOTE_VISIBILITY_LABELS: Record<NoteVisibility, string> = {
  CASE_TEAM: "Case team",
  STRATEGY: "Strategy — hidden from paralegals",
};

/** Column order for the Kanban board; also the natural lifecycle order. */
export const CASE_STATUS_ORDER: readonly CaseStatus[] = [
  "FILED",
  "UNDER_TRIAL",
  "JUDGMENT",
  "APPEAL",
  "CLOSED",
] as const;

export const CASE_TYPE_ORDER: readonly CaseType[] = [
  "CIVIL",
  "CRIMINAL",
  "CORPORATE",
  "FAMILY",
] as const;

export const CASE_ROLE_ORDER: readonly CaseRole[] = [
  "LEAD_COUNSEL",
  "CO_COUNSEL",
  "SUPPORTING_ADVOCATE",
  "PARALEGAL",
] as const;

/**
 * Tailwind classes per status. Kept as complete literal strings because
 * Tailwind's scanner cannot resolve interpolated class names.
 */
/** Shared chip shell for every case-status badge. */
const CHIP = "border-hairline bg-raised text-secondary";

export const CASE_STATUS_STYLES: Record<
  CaseStatus,
  { badge: string; dot: string; column: string }
> = {
  // The chip is deliberately uniform: the coloured dot carries the hue and
  // the label carries the meaning, so status is never encoded by colour
  // alone. Five tinted pills also read as a rainbow against off-white.
  FILED: {
    badge: CHIP,
    dot: "bg-status-filed",
    column: "border-t-status-filed",
  },
  UNDER_TRIAL: {
    badge: CHIP,
    dot: "bg-status-trial",
    column: "border-t-status-trial",
  },
  JUDGMENT: {
    badge: CHIP,
    dot: "bg-status-judgment",
    column: "border-t-status-judgment",
  },
  APPEAL: {
    badge: CHIP,
    dot: "bg-status-appeal",
    column: "border-t-status-appeal",
  },
  CLOSED: {
    badge: CHIP,
    dot: "bg-status-closed",
    column: "border-t-status-closed",
  },
};
