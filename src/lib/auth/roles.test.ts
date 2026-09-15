import { describe, expect, it } from "vitest";
import {
  ALL_ROLES,
  canCreateCases,
  canDeleteDocuments,
  canEditCase,
  canManageUsers,
  canReadAllCases,
  canReadTeamCases,
  canViewReports,
  canViewStrategyNotes,
  canWriteStrategyNotes,
  isRouteAllowedForRole,
} from "./roles";

describe("capability model", () => {
  it("hides strategy notes from paralegals only", () => {
    for (const role of ALL_ROLES) {
      const expected = role !== "PARALEGAL";
      expect(canViewStrategyNotes(role)).toBe(expected);
      expect(canWriteStrategyNotes(role)).toBe(expected);
    }
  });

  it("gives firm-wide case visibility to partners only", () => {
    expect(ALL_ROLES.filter(canReadAllCases)).toEqual(["ADMIN_PARTNER"]);
    expect(ALL_ROLES.filter(canReadTeamCases)).toEqual(["SENIOR_ADVOCATE"]);
    expect(ALL_ROLES.filter(canManageUsers)).toEqual(["ADMIN_PARTNER"]);
  });

  it("limits case creation, editing and document deletion", () => {
    expect(ALL_ROLES.filter(canCreateCases)).toEqual([
      "ADMIN_PARTNER",
      "SENIOR_ADVOCATE",
    ]);
    expect(canEditCase("PARALEGAL")).toBe(false);
    expect(canEditCase("ASSOCIATE")).toBe(true);
    expect(ALL_ROLES.filter(canDeleteDocuments)).toEqual([
      "ADMIN_PARTNER",
      "SENIOR_ADVOCATE",
    ]);
  });
});

describe("isRouteAllowedForRole", () => {
  it("restricts admin and partner-only settings", () => {
    for (const path of ["/admin", "/admin/users", "/settings/team", "/settings/firm"]) {
      expect(isRouteAllowedForRole(path, "ADMIN_PARTNER")).toBe(true);
      expect(isRouteAllowedForRole(path, "SENIOR_ADVOCATE")).toBe(false);
      expect(isRouteAllowedForRole(path, "PARALEGAL")).toBe(false);
    }
  });

  it("lets reports follow canViewReports", () => {
    for (const role of ALL_ROLES) {
      expect(isRouteAllowedForRole("/reports", role)).toBe(canViewReports(role));
    }
  });

  it("matches whole path segments, not string prefixes", () => {
    expect(isRouteAllowedForRole("/administration", "PARALEGAL")).toBe(true);
    expect(isRouteAllowedForRole("/settings", "PARALEGAL")).toBe(true);
    expect(isRouteAllowedForRole("/settings/security", "PARALEGAL")).toBe(true);
  });
});
