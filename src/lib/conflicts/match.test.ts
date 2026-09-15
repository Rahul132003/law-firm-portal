import { describe, expect, it } from "vitest";
import {
  compareParties,
  findConflicts,
  normalisePartyName,
  searchTerms,
  type CandidateCase,
} from "./match";

describe("normalisePartyName", () => {
  it.each([
    ["M/s. Metro Developments Pvt. Ltd.", "metro developments"],
    ["Shri Rahul  Kumar Sharma", "rahul kumar sharma"],
    ["The Tata & Sons Company Limited", "tata sons"],
    ["Dr. José Álvarez", "jose alvarez"],
    ["State of Maharashtra", "state maharashtra"],
  ])("%s → %s", (input, expected) => {
    expect(normalisePartyName(input)).toBe(expected);
  });

  it("returns empty for a name that is all noise", () => {
    expect(normalisePartyName("M/s The Company Ltd.")).toBe("");
  });
});

describe("compareParties", () => {
  it("treats formatting differences as exact", () => {
    expect(compareParties("Metro Developments Ltd", "M/S METRO DEVELOPMENTS PRIVATE LIMITED")).toBe("exact");
    expect(compareParties("Smt. Sneha Patel", "sneha patel")).toBe("exact");
  });

  it("matches a name contained in a longer one", () => {
    expect(compareParties("Rahul Sharma", "Rahul Kumar Sharma")).toBe("partial");
    expect(compareParties("Tata Motors Limited", "Tata Motors Finance")).toBe("partial");
  });

  it("does not match different people who share one name", () => {
    expect(compareParties("Rahul Sharma", "Rahul Verma")).toBeNull();
  });

  it("ignores very short single words, which would match everything", () => {
    expect(compareParties("Raj", "Raj Kumar Industries")).toBeNull();
    expect(compareParties("Tata", "Tata Steel")).toBe("partial");
  });

  it("never matches empty names", () => {
    expect(compareParties("", "anything")).toBeNull();
    expect(compareParties("The Ltd", "The Ltd")).toBeNull();
  });
});

describe("searchTerms", () => {
  it("collects distinct useful words from all names", () => {
    expect(searchTerms("M/s Metro Developments Ltd", null, "Metro Rail")).toEqual([
      "metro",
      "developments",
      "rail",
    ]);
  });
});

const candidate = (overrides: Partial<CandidateCase>): CandidateCase => ({
  id: "c1",
  caseNumber: "CS/1/2025",
  title: "Existing matter",
  status: "UNDER_TRIAL",
  clientName: "Unrelated Client",
  opposingParty: null,
  ...overrides,
});

describe("findConflicts", () => {
  it("flags acting for someone the firm is already opposing", () => {
    const [match] = findConflicts(
      { clientName: "Metro Developments Ltd", opposingParty: null },
      [candidate({ opposingParty: "M/s Metro Developments Pvt Ltd" })],
    );
    expect(match).toMatchObject({ severity: "adverse", strength: "exact" });
    expect(match!.reason).toMatch(/opposing party in this matter/);
  });

  it("flags acting against an existing client", () => {
    const [match] = findConflicts(
      { clientName: "New Client", opposingParty: "Sneha Patel" },
      [candidate({ clientName: "Smt. Sneha Patel" })],
    );
    expect(match).toMatchObject({ severity: "adverse" });
    expect(match!.reason).toMatch(/a client of the firm/);
  });

  it("reports the same client on another matter as related, not adverse", () => {
    const matches = findConflicts(
      { clientName: "Sneha Patel", opposingParty: "Someone Else" },
      [candidate({ clientName: "Sneha Patel" })],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]!.severity).toBe("related");
  });

  it("keeps only the most serious finding per matter", () => {
    const matches = findConflicts(
      { clientName: "Sneha Patel", opposingParty: null },
      // Same person appears as both client and opposing party (e.g. a cross-suit).
      [candidate({ clientName: "Sneha Patel", opposingParty: "Sneha Patel" })],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]!.severity).toBe("adverse");
  });

  it("sorts adverse exact matches first", () => {
    const matches = findConflicts(
      { clientName: "Rahul Sharma", opposingParty: null },
      [
        candidate({ id: "related", clientName: "Rahul Sharma" }),
        candidate({ id: "partial", opposingParty: "Rahul Kumar Sharma" }),
        candidate({ id: "exact", opposingParty: "Shri Rahul Sharma" }),
      ],
    );
    expect(matches.map((m) => m.caseId)).toEqual(["exact", "partial", "related"]);
  });

  it("returns nothing when no party matches", () => {
    expect(
      findConflicts({ clientName: "Alpha", opposingParty: "Beta Corp" }, [
        candidate({ clientName: "Gamma", opposingParty: "Delta" }),
      ]),
    ).toEqual([]);
  });
});
