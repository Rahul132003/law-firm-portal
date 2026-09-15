import type { Metadata } from "next";
import { Users } from "lucide-react";

import { UserManager, type ManagedUser } from "@/components/admin/user-manager";
import { canManageUsers } from "@/lib/auth/roles";
import { emailKey } from "@/lib/auth/throttle";
import { requireCapability } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: `Team & Access · ${FIRM_NAME}`,
};

export default async function SettingsTeamPage(
  props: PageProps<"/settings/team">,
) {
  // Partners only; throws 403 for everyone else. The tab is hidden from other
  // roles, but this is the check that actually decides.
  const user = await requireCapability(canManageUsers);

  // `?new=1` opens the create form straight away, so "Add a user" shortcuts
  // from elsewhere in the portal land on a form rather than on a list.
  const { new: openCreate } = await props.searchParams;

  const rows = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      supervisorId: true,
      supervisor: { select: { name: true } },
      _count: {
        select: {
          assignments: true,
          assignedTasks: { where: { status: { not: "DONE" } } },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
  });

  const locks = await prisma.loginThrottle.findMany({
    where: {
      key: { in: rows.map((row) => emailKey(row.email)) },
      lockedUntil: { gt: new Date() },
    },
    select: { key: true, lockedUntil: true },
  });
  const lockedUntilByKey = new Map(
    locks.map((lock) => [lock.key, lock.lockedUntil!.toISOString()]),
  );

  const users: ManagedUser[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    supervisorId: row.supervisorId,
    supervisorName: row.supervisor?.name ?? null,
    caseCount: row._count.assignments,
    openTaskCount: row._count.assignedTasks,
    lockedUntil: lockedUntilByKey.get(emailKey(row.email)) ?? null,
  }));

  const activeCount = users.filter((person) => person.isActive).length;

  return (
    <div className="space-y-6">
      <section className="surface-card p-6 md:p-8">
        <div className="mb-5 flex items-center gap-3 border-b border-hairline pb-4">
          <div className="rounded-xl bg-accent-50 p-2 text-accent-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-base font-bold text-primary">
              Staff Accounts
            </h2>
            <p className="text-xs text-muted">
              {activeCount} active {activeCount === 1 ? "person" : "people"} of{" "}
              {users.length} on record · roles, supervisors and sign-in access.
            </p>
          </div>
        </div>

        <UserManager
          users={users}
          currentUserId={user.id}
          defaultCreateOpen={openCreate === "1"}
        />
      </section>

      <section className="surface-card p-6 md:p-8">
        <h2 className="font-serif text-base font-bold text-primary">
          How these decisions behave
        </h2>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-secondary">
          <li>
            Deactivating someone blocks sign-in immediately, on their next
            request — it does not wait for their session to expire.
          </li>
          <li>
            Accounts are deactivated, never deleted: audit entries, uploaded
            documents and case history all reference the user, and that trail
            has to survive someone leaving the firm.
          </li>
          <li>
            A senior advocate sees the cases of anyone who reports to them, so
            the supervisor field is what defines a team.
          </li>
        </ul>
      </section>
    </div>
  );
}
