/**
 * Party-name matching for conflict-of-interest checks.
 *
 * Pure functions, no database: the server layer (./check.ts) fetches candidate
 * cases and hands them here.
 *
 * The bias is deliberately toward recall. A false positive costs a partner a
 * few seconds of review; a missed conflict can cost the firm the matter and a
 * disciplinary complaint. So names are compared after stripping honorifics,
 * corporate suffixes and punctuation, and a name contained in a longer one
 * ("Rahul Sharma" in "Rahul Kumar Sharma", "Tata Motors" in "Tata Motors
 * Limited") counts as a match.
 */

/** Dropped anywhere in a name: they identify form, not the party. */
const NOISE_WORDS = new Set([
  // Honorifics common in Indian and English pleadings.
  "mr", "mrs", "ms", "miss", "dr", "shri", "sri", "smt", "kumari", "km", "prof",
  "adv", "late",
  // Corporate form.
  "m/s", "pvt", "private", "ltd", "limited", "llp", "inc", "incorporated",
  "corp", "corporation", "co", "company", "plc", "llc", "the",
  // Connectives.
  "and", "of",
]);

/** Minimum length for a single-word name to match inside a longer one. */
const MIN_SINGLE_TOKEN = 4;

export function normalisePartyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/\bm\/s\b/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word && !NOISE_WORDS.has(word))
    .join(" ");
}

export type MatchStrength = "exact" | "partial";

/** How closely two party names match, or null for no match. */
export function compareParties(a: string, b: string): MatchStrength | null {
  const left = normalisePartyName(a);
  const right = normalisePartyName(b);
  if (!left || !right) return null;
  if (left === right) return "exact";

  const leftWords = left.split(" ");
  const rightWords = right.split(" ");
  const [shorter, longer] =
    leftWords.length <= rightWords.length
      ? [leftWords, new Set(rightWords)]
      : [rightWords, new Set(leftWords)];

  if (shorter.length === 1 && shorter[0]!.length < MIN_SINGLE_TOKEN) {
    return null;
  }

  return shorter.every((word) => longer.has(word)) ? "partial" : null;
}

/**
 * Words worth using to pre-filter candidates in SQL. Short words are skipped
 * because `contains` on them would return most of the table.
 */
export function searchTerms(...names: Array<string | null | undefined>): string[] {
  const terms = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    for (const word of normalisePartyName(name).split(" ")) {
      if (word.length >= 3) terms.add(word);
    }
  }
  return [...terms];
}

export type CandidateCase = {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  clientName: string;
  opposingParty: string | null;
};

/**
 * - `adverse`: the firm is, or was, on the other side from this party. Must be
 *   cleared or waived before the case is saved.
 * - `related`: same party on the same side elsewhere. Informational.
 */
export type ConflictSeverity = "adverse" | "related";

export type ConflictMatch = {
  caseId: string;
  caseNumber: string;
  title: string;
  status: string;
  severity: ConflictSeverity;
  strength: MatchStrength;
  /** Plain-English explanation for the reviewer. */
  reason: string;
};

export function findConflicts(
  input: { clientName: string; opposingParty: string | null },
  candidates: CandidateCase[],
): ConflictMatch[] {
  const matches: ConflictMatch[] = [];

  for (const candidate of candidates) {
    const base = {
      caseId: candidate.id,
      caseNumber: candidate.caseNumber,
      title: candidate.title,
      status: candidate.status,
    };

    // Most serious first; one row per candidate, keeping the worst finding.
    const checks: Array<{
      ours: string | null;
      theirs: string | null;
      severity: ConflictSeverity;
      reason: (ours: string, theirs: string) => string;
    }> = [
      {
        ours: input.clientName,
        theirs: candidate.opposingParty,
        severity: "adverse",
        reason: (ours, theirs) =>
          `Your client "${ours}" matches "${theirs}", the opposing party in this matter.`,
      },
      {
        ours: input.opposingParty,
        theirs: candidate.clientName,
        severity: "adverse",
        reason: (ours, theirs) =>
          `The opposing party "${ours}" matches "${theirs}", a client of the firm in this matter.`,
      },
      {
        ours: input.clientName,
        theirs: candidate.clientName,
        severity: "related",
        reason: (ours, theirs) => `"${ours}" is also the client ("${theirs}") in this matter.`,
      },
      {
        ours: input.opposingParty,
        theirs: candidate.opposingParty,
        severity: "related",
        reason: (ours, theirs) =>
          `"${ours}" is also the opposing party ("${theirs}") in this matter.`,
      },
    ];

    for (const check of checks) {
      if (!check.ours || !check.theirs) continue;
      const strength = compareParties(check.ours, check.theirs);
      if (!strength) continue;

      matches.push({
        ...base,
        severity: check.severity,
        strength,
        reason: check.reason(check.ours, check.theirs),
      });
      break;
    }
  }

  const rank = (m: ConflictMatch) =>
    (m.severity === "adverse" ? 0 : 2) + (m.strength === "exact" ? 0 : 1);
  return matches.sort((a, b) => rank(a) - rank(b));
}
