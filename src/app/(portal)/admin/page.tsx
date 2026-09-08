import type { Metadata } from "next";
import Link from "next/link";

import {
  UserManager,
  type ManagedUser,
} from "@/components/admin/user-manager";
import { buttonClass } from "@/components/ui/button";
import { canManageUsers } from "@/lib/auth/roles";
import { requireCapability } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { prisma } from "@/lib/prisma";
import { getFirmSummary } from "@/lib/reports/queries";
import { serverNow } from "@/lib/time";

export const metadata: Metadata = {
  title: `Administration · ${FIRM_NAME}`,
};

export default async function AdminPage() {
  // Partners only; throws 403 for everyone else.
  const user = await requireCapability(canManageUsers);
  const now = serverNow();

  const [rows, summary] = await Promise.all([
    prisma.user.findMany({
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
    }),
    getFirmSummary({ user, now }),
  ]);

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
  }));

  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Administration
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {activeCount} active {activeCount === 1 ? "person" : "people"} ·{" "}
            {summary.totalCases} matters · {summary.documentCount} documents
          </p>
        </div>
        <Link href="/reports" className={buttonClass("secondary", "sm")}>
          Firm reports
        </Link>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-primary">
          Staff accounts
        </h2>
        <UserManager users={users} currentUserId={user.id} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-primary">Notes</h2>
        <ul className="mt-2 space-y-1.5 text-xs text-secondary">
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
