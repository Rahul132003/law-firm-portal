import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { caseScopeFilter, type SessionUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  findConflicts,
  searchTerms,
  type ConflictMatch,
} from "./match";

/**
 * Server side of the conflict check.
 *
 * The search is **firm-wide by design** — a conflict on a matter you are not
 * staffed on is still a conflict. What the caller learns about matters outside
 * their own case scope is kept to the minimum needed to act: that a match
 * exists, why, and the matter's status. Case number and title are withheld,
 * and they are told to ask a partner.
 */

/** Upper bound on candidates pulled for in-memory matching. */
const CANDIDATE_LIMIT = 1000;

export type VisibleConflict = Omit<ConflictMatch, "caseId" | "caseNumber" | "title"> & {
  /** Present only when the caller can open the matched case. */
  caseId: string | null;
  caseNumber: string | null;
  title: string | null;
};

export type ConflictReport = {
  adverse: VisibleConflict[];
  related: VisibleConflict[];
  /**
   * Identifies exactly which adverse matches were found. The form echoes it
   * back with a waiver, so a waiver given for one set of conflicts cannot be
   * silently applied to a different set after the party names change.
   */
  fingerprint: string;
  /** Full matches, for the stored record. Never send this to the browser. */
  raw: ConflictMatch[];
};

/** What the browser may see of a report. */
export type ConflictPreview = Pick<ConflictReport, "adverse" | "related" | "fingerprint">;

export function toPreview(report: ConflictReport): ConflictPreview {
  return {
    adverse: report.adverse,
    related: report.related,
    fingerprint: report.fingerprint,
  };
}

function fingerprintOf(matches: ConflictMatch[]): string {
  const adverseIds = matches
    .filter((m) => m.severity === "adverse")
    .map((m) => m.caseId)
    .sort();
  if (adverseIds.length === 0) return "";
  return createHash("sha256").update(adverseIds.join("|")).digest("hex").slice(0, 16);
}

export async function runConflictCheck(
  user: SessionUser,
  input: { clientName: string; opposingParty: string | null; excludeCaseId?: string },
): Promise<ConflictReport> {
  const terms = searchTerms(input.clientName, input.opposingParty);
  if (terms.length === 0) return { adverse: [], related: [], fingerprint: "", raw: [] };

  const candidates = await prisma.case.findMany({
    where: {
      ...(input.excludeCaseId ? { NOT: { id: input.excludeCaseId } } : {}),
      OR: terms.flatMap((term): Prisma.CaseWhereInput[] => [
        { clientName: { contains: term, mode: "insensitive" } },
        { opposingParty: { contains: term, mode: "insensitive" } },
      ]),
    },
    select: {
      id: true,
      caseNumber: true,
      title: true,
      status: true,
      clientName: true,
      opposingParty: true,
    },
    orderBy: { updatedAt: "desc" },
    take: CANDIDATE_LIMIT,
  });

  const raw = findConflicts(input, candidates);
  if (raw.length === 0) return { adverse: [], related: [], fingerprint: "", raw };

  const accessible = new Set(
    (
      await prisma.case.findMany({
        where: { id: { in: raw.map((m) => m.caseId) }, ...(await caseScopeFilter(user)) },
        select: { id: true },
      })
    ).map((row) => row.id),
  );

  const visible = raw.map((match): VisibleConflict => {
    if (accessible.has(match.caseId)) return match;
    return {
      ...match,
      caseId: null,
      caseNumber: null,
      title: null,
    };
  });

  return {
    adverse: visible.filter((m) => m.severity === "adverse"),
    related: visible.filter((m) => m.severity === "related"),
    fingerprint: fingerprintOf(raw),
    raw,
  };
}

/** The JSON snapshot stored on ConflictCheck.matches. */
export function snapshotMatches(matches: ConflictMatch[]): Prisma.InputJsonValue {
  return matches.map((m) => ({
    caseId: m.caseId,
    caseNumber: m.caseNumber,
    title: m.title,
    severity: m.severity,
    strength: m.strength,
    reason: m.reason,
  }));
}
