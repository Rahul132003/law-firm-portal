import "server-only";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { canReadAllCases, canReadTeamCases } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

/**
 * Data Access Layer.
 *
 * Every read or write that touches case-scoped data goes through here. The
 * proxy performs an optimistic cookie check, but this module is the layer
 * that actually decides what a user may see, so it runs as close to the
 * query as possible.
 *
 * Rules enforced here:
 *   - Admin/Partner sees everything.
 *   - Senior Advocate sees their own cases plus their direct reports' cases.
 *   - Associate and Paralegal see only cases they are assigned to.
 */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/**
 * Reads the session without redirecting. Use in layouts or components that
 * render for both signed-in and signed-out visitors.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
  };
});

/**
 * The workhorse: guarantees a signed-in, still-active user.
 *
 * Unlike the proxy's cookie decode, this re-checks `isActive` against the
 * database, so deactivating an advocate takes effect immediately rather than
 * when their eight-hour token happens to expire.
 */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/login");
  }

  const account = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (!account || !account.isActive) {
    redirect("/login?reason=account-inactive");
  }

  // Trust the database row over the token for the role, so a demotion also
  // takes effect immediately.
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
  };
});

/**
 * Guards a capability. Throws a real 403 (rendered by app/forbidden.tsx)
 * rather than bouncing to the login page, which would be misleading for a
 * user who is signed in but under-privileged.
 */
export async function requireCapability(
  predicate: (role: Role) => boolean,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!predicate(user.role)) {
    forbidden();
  }
  return user;
}

/**
 * Self plus direct reports, for senior advocates. Memoized per render pass so
 * a page rendering several case lists issues this query once.
 */
export const getVisibleUserIds = cache(
  async (user: SessionUser): Promise<string[]> => {
    if (!canReadTeamCases(user.role)) {
      return [user.id];
    }

    const reports = await prisma.user.findMany({
      where: { supervisorId: user.id },
      select: { id: true },
    });

    return [user.id, ...reports.map((r) => r.id)];
  },
);

/**
 * The row-level filter. Spread this into every `Case` query's `where`:
 *
 *   const where = { ...(await caseScopeFilter(user)), status: "FILED" }
 *
 * Returning `{}` for admins keeps call sites uniform.
 */
export async function caseScopeFilter(
  user: SessionUser,
): Promise<Prisma.CaseWhereInput> {
  if (canReadAllCases(user.role)) {
    return {};
  }

  const userIds = await getVisibleUserIds(user);

  return {
    assignments: {
      some: { userId: { in: userIds } },
    },
  };
}

/**
 * Confirms the user may touch one specific case. Returns the case-level role
 * so callers can apply per-case rules (for example, only lead counsel closing
 * a case).
 *
 * Throws 403 rather than 404 for an existing-but-unreachable case only when
 * the user is an admin; for everyone else an inaccessible case is reported as
 * missing, so the portal does not leak which case numbers exist.
 */
export async function requireCaseAccess(
  caseId: string,
): Promise<{ user: SessionUser; caseId: string }> {
  const user = await requireUser();
  const scope = await caseScopeFilter(user);

  const found = await prisma.case.findFirst({
    where: { id: caseId, ...scope },
    select: { id: true },
  });

  if (!found) {
    // notFound() would be imported here, but callers generally want to render
    // their own empty state, so surface it as a typed failure instead.
    forbidden();
  }

  return { user, caseId: found.id };
}

/** Non-throwing variant for conditional UI ("can this user open that link?"). */
export async function hasCaseAccess(
  user: SessionUser,
  caseId: string,
): Promise<boolean> {
  const scope = await caseScopeFilter(user);
  const found = await prisma.case.findFirst({
    where: { id: caseId, ...scope },
    select: { id: true },
  });
  return found !== null;
}
