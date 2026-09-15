import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "./dal";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    case: { findFirst: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  forbidden: () => {
    throw new Error("FORBIDDEN");
  },
}));

const { caseScopeFilter, requireUser, requireCaseAccess, requireCapability } =
  await import("./dal");

const user = (role: SessionUser["role"], id = "u1"): SessionUser => ({
  id,
  name: "Test",
  email: "t@example.com",
  role,
});

function signIn(account: SessionUser & { isActive?: boolean }, tokenRole = account.role) {
  mocks.auth.mockResolvedValue({ user: { ...account, role: tokenRole } });
  mocks.prisma.user.findUnique.mockResolvedValue({ isActive: true, ...account });
}

beforeEach(() => vi.resetAllMocks());

describe("caseScopeFilter", () => {
  it("returns no restriction for partners", async () => {
    expect(await caseScopeFilter(user("ADMIN_PARTNER"))).toEqual({});
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it.each(["ASSOCIATE", "PARALEGAL"] as const)(
    "limits %s to their own assignments",
    async (role) => {
      expect(await caseScopeFilter(user(role))).toEqual({
        assignments: { some: { userId: { in: ["u1"] } } },
      });
      expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
    },
  );

  it("widens senior advocates to their direct reports", async () => {
    mocks.prisma.user.findMany.mockResolvedValue([{ id: "r1" }, { id: "r2" }]);
    expect(await caseScopeFilter(user("SENIOR_ADVOCATE", "sa"))).toEqual({
      assignments: { some: { userId: { in: ["sa", "r1", "r2"] } } },
    });
    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { supervisorId: "sa" } }),
    );
  });
});

describe("requireUser", () => {
  it("redirects anonymous visitors to login", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects a deactivated account even with a valid token", async () => {
    signIn({ ...user("ASSOCIATE"), isActive: false });
    await expect(requireUser()).rejects.toThrow("account-inactive");
  });

  it("rejects a token for a user that no longer exists", async () => {
    signIn(user("ASSOCIATE"));
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT");
  });

  it("trusts the database role over the token role", async () => {
    signIn(user("PARALEGAL"), "ADMIN_PARTNER");
    expect((await requireUser()).role).toBe("PARALEGAL");
  });
});

describe("requireCapability", () => {
  it("throws 403 when the role lacks the capability", async () => {
    signIn(user("ASSOCIATE"));
    await expect(requireCapability((r) => r === "ADMIN_PARTNER")).rejects.toThrow(
      "FORBIDDEN",
    );
  });
});

describe("requireCaseAccess", () => {
  it("queries the case through the user's scope and returns it", async () => {
    signIn(user("ASSOCIATE"));
    mocks.prisma.case.findFirst.mockResolvedValue({ id: "c1" });

    await expect(requireCaseAccess("c1")).resolves.toMatchObject({ caseId: "c1" });
    expect(mocks.prisma.case.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1", assignments: { some: { userId: { in: ["u1"] } } } },
      }),
    );
  });

  it("throws 403 for a case outside the user's scope", async () => {
    signIn(user("ASSOCIATE"));
    mocks.prisma.case.findFirst.mockResolvedValue(null);
    await expect(requireCaseAccess("someone-elses")).rejects.toThrow("FORBIDDEN");
  });
});
