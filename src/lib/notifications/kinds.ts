import type { NotificationKind, Role } from "@/generated/prisma/enums";

/**
 * Catalogue of notification kinds. Pure data, safe for client components.
 */

type KindInfo = {
  label: string;
  description: string;
  /** Mandatory kinds are delivered even if a user has muted them. */
  mandatory: boolean;
  /** Only shown in preferences to roles that can receive it. */
  audience?: (role: Role) => boolean;
};

export const NOTIFICATION_KINDS: Record<NotificationKind, KindInfo> = {
  HEARING_REMINDER: {
    label: "Hearing reminders",
    description: "7, 3 and 1 day before a hearing on your cases.",
    mandatory: true,
  },
  TASK_DUE: {
    label: "Deadline alerts",
    description: "Upcoming and overdue tasks, filing and limitation deadlines.",
    mandatory: true,
  },
  NOTICE_POSTED: {
    label: "Firm notices",
    description: "New announcements on the notice board.",
    mandatory: true,
  },
  CONFLICT_WAIVED: {
    label: "Conflict waivers",
    description: "A case was saved despite a possible conflict of interest.",
    mandatory: true,
    audience: (role) => role === "ADMIN_PARTNER",
  },
  TASK_ASSIGNED: {
    label: "Tasks assigned to you",
    description: "Someone else gives you a task or reassigns one to you.",
    mandatory: false,
  },
  TASK_COMPLETED: {
    label: "Tasks you raised are done",
    description: "A task you created for someone else is marked done.",
    mandatory: false,
  },
  CASE_ASSIGNED: {
    label: "Added to a case",
    description: "You are added to a case team.",
    mandatory: false,
  },
  HEARING_SCHEDULED: {
    label: "Hearings scheduled or moved",
    description: "A hearing on one of your cases is added or its date changes.",
    mandatory: false,
  },
  DOCUMENT_UPLOADED: {
    label: "New documents",
    description: "A document or new version is uploaded to one of your cases.",
    mandatory: false,
  },
  NOTE_ADDED: {
    label: "New case notes",
    description: "A colleague adds a note to one of your cases.",
    mandatory: false,
  },
  CASE_STATUS_CHANGED: {
    label: "Case status changes",
    description: "One of your cases moves to a new stage, such as judgment or appeal.",
    mandatory: false,
  },
};

export const NOTIFICATION_KIND_ORDER = Object.keys(NOTIFICATION_KINDS) as NotificationKind[];

export function isMandatoryKind(kind: NotificationKind): boolean {
  return NOTIFICATION_KINDS[kind].mandatory;
}

/** True when this person should receive `kind`, given what they have muted. */
export function wantsKind(kind: NotificationKind, muted: readonly NotificationKind[]): boolean {
  return isMandatoryKind(kind) || !muted.includes(kind);
}
