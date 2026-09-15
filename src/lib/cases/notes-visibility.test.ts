import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCaseAccess: vi.fn(),
  requireUser: vi.fn(),
  prisma: {
    caseNote: { findMany: vi.fn(), count: vi.fn() },
    document: { count: vi.fn() },
    hearing: { count: vi.fn() },
    task: { count: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/dal", () => ({
  caseScopeFilter: vi.fn(),
  requireCaseAccess: mocks.requireCaseAccess,
  requireUser: mocks.requireUser,
}));
vi.mock("@/lib/crypto", () => ({ safeDecryptField: (v: string) => `plain:${v}` }));

const { getCaseNotes, getCaseTabCounts } = await import("./queries");

const as = (role: string) => ({ id: "u1", name: "", email: "", role });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.prisma.caseNote.findMany.mockResolvedValue([]);
});

describe("strategy note visibility", () => {
  it("filters strategy notes out in SQL for paralegals", async () => {
    mocks.requireCaseAccess.mockResolvedValue({ user: as("PARALEGAL"), caseId: "c1" });

    await getCaseNotes("c1");

    expect(mocks.prisma.caseNote.findMany.mock.calls[0]![0].where).toEqual({
      caseId: "c1",
      visibility: "CASE_TEAM",
    });
  });

  it.each(["ADMIN_PARTNER", "SENIOR_ADVOCATE", "ASSOCIATE"])(
    "returns every note to %s",
    async (role) => {
      mocks.requireCaseAccess.mockResolvedValue({ user: as(role), caseId: "c1" });

      await getCaseNotes("c1");

      expect(mocks.prisma.caseNote.findMany.mock.calls[0]![0].where).toEqual({
        caseId: "c1",
      });
    },
  );

  it("checks case access before querying notes", async () => {
    mocks.requireCaseAccess.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(getCaseNotes("c1")).rejects.toThrow("FORBIDDEN");
    expect(mocks.prisma.caseNote.findMany).not.toHaveBeenCalled();
  });

  it("decrypts bodies on the way out", async () => {
    mocks.requireCaseAccess.mockResolvedValue({ user: as("ASSOCIATE"), caseId: "c1" });
    mocks.prisma.caseNote.findMany.mockResolvedValue([{ id: "n1", body: "cipher" }]);

    expect(await getCaseNotes("c1")).toEqual([{ id: "n1", body: "plain:cipher" }]);
  });

  it("does not count strategy notes in a paralegal's tab badge", async () => {
    mocks.requireUser.mockResolvedValue(as("PARALEGAL"));

    await getCaseTabCounts("c1");

    expect(mocks.prisma.caseNote.count).toHaveBeenCalledWith({
      where: { caseId: "c1", visibility: "CASE_TEAM" },
    });
  });
});
