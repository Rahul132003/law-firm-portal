import type { Role } from "@/generated/prisma/enums";

/**
 * Firm-wide capability model.
 *
 * These helpers answer "may this role ever do X". They deliberately do NOT * answer "may this user touch this case" — that is row-level scoping and
 * lives in the data access layer (src/lib/dal.ts), close to the query.
 */

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN_PARTNER: "Admin / Partner",
  SENIOR_ADVOCATE: "Senior Advocate",
  ASSOCIATE: "Associate",
  PARALEGAL: "Paralegal / Clerk",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN_PARTNER: "Full access to all cases, users and firm settings.",
  SENIOR_ADVOCATE: "Own cases plus every case assigned to their team.",
  ASSOCIATE: "Only cases they are personally assigned to.",
  PARALEGAL: "Document handling on assigned cases. No strategy notes.",
};

/** Every role, in descending order of privilege. Useful for admin pickers. */
export const ALL_ROLES: readonly Role[] = [
  "ADMIN_PARTNER",
  "SENIOR_ADVOCATE",
  "ASSOCIATE",
  "PARALEGAL",
] as const;

export function isAdmin(role: Role): boolean {
  return role === "ADMIN_PARTNER";
}

/** Admins bypass case-assignment scoping entirely. */
export function canReadAllCases(role: Role): boolean {
  return isAdmin(role);
}

/** Senior advocates additionally see cases assigned to their direct reports. */
export function canReadTeamCases(role: Role): boolean {
  return role === "SENIOR_ADVOCATE";
}

export function canManageUsers(role: Role): boolean {
  return isAdmin(role);
}

export function canCreateCases(role: Role): boolean {
  return role === "ADMIN_PARTNER" || role === "SENIOR_ADVOCATE";
}

/** Paralegals organise documents; they do not edit case records. */
export function canEditCase(role: Role): boolean {
  return role !== "PARALEGAL";
}

export function canDeleteCase(role: Role): boolean {
  return isAdmin(role);
}

/**
 * The paralegal carve-out required by the brief: document upload/organise
 * access, but case strategy notes stay invisible.
 */
export function canViewStrategyNotes(role: Role): boolean {
  return role !== "PARALEGAL";
}

export function canWriteStrategyNotes(role: Role): boolean {
  return role !== "PARALEGAL";
}

export function canUploadDocuments(): boolean {
  // Every role, paralegals very much included, may upload to their cases.
  return true;
}

export function canDeleteDocuments(role: Role): boolean {
  return role !== "ASSOCIATE" && role !== "PARALEGAL";
}

export function canManageHearings(role: Role): boolean {
  return role !== "PARALEGAL";
}

export function canAssignTasks(role: Role): boolean {
  return role !== "PARALEGAL";
}

export function canPostNotices(role: Role): boolean {
  return isAdmin(role);
}

export function canViewReports(role: Role): boolean {
  return role === "ADMIN_PARTNER" || role === "SENIOR_ADVOCATE";
}

export function canViewAuditLog(role: Role): boolean {
  return isAdmin(role);
}

/**
 * Route prefixes that require a specific role, checked optimistically in
 * src/proxy.ts and again authoritatively inside each page's data access.
 */
export const ROLE_RESTRICTED_PREFIXES: ReadonlyArray<{
  prefix: string;
  allow: (role: Role) => boolean;
}> = [
  { prefix: "/admin", allow: isAdmin },
  { prefix: "/reports", allow: canViewReports },
];

export function isRouteAllowedForRole(pathname: string, role: Role): boolean {
  const rule = ROLE_RESTRICTED_PREFIXES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return rule ? rule.allow(role) : true;
}
