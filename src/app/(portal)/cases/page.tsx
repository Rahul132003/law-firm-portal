import type { Metadata } from "next";
import Link from "next/link";
import { CaseFilters, ViewToggle } from "@/components/cases/case-filters";
import { CaseTable } from "@/components/cases/case-table";
import { KanbanBoard } from "@/components/cases/kanban-board";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { CaseStatus, CaseType } from "@/generated/prisma/enums";
import { canCreateCases, canEditCase } from "@/lib/auth/roles";
import {
  getAssignableStaff,
  getCourtOptions,
  listCases,
  listCasesByStatus,
  type CaseFilters as Filters,
} from "@/lib/cases/queries";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `Cases · ${FIRM_NAME}`,
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single && single.trim() !== "" ? single : undefined;
}

const STATUSES = ["FILED", "UNDER_TRIAL", "JUDGMENT", "APPEAL", "CLOSED"];
const TYPES = ["CIVIL", "CRIMINAL", "CORPORATE", "FAMILY"];
export default async function CasesPage(props: PageProps<"/cases">) {
  const searchParams = await props.searchParams;
  const user = await requireUser();

  const view = first(searchParams, "view") === "board" ? "board" : "list";

  // Validate enum params rather than trusting the URL — an unknown value
  // would otherwise reach Prisma and throw.
  const statusParam = first(searchParams, "status");
  const typeParam = first(searchParams, "caseType");

  const filters: Filters = {
    status:
      statusParam && STATUSES.includes(statusParam)
        ? (statusParam as CaseStatus)
        : undefined,
    caseType:
      typeParam && TYPES.includes(typeParam)
        ? (typeParam as CaseType)
        : undefined,
    court: first(searchParams, "court"),
    advocateId: first(searchParams, "advocateId"),
    q: first(searchParams, "q"),
  };

  const [courts, staff] = await Promise.all([
    getCourtOptions(user),
    getAssignableStaff(),
  ]);

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="mx-auto max-w-7xl">
      {" "}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Cases
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {" "}
            {user.role === "ADMIN_PARTNER"
              ? "Every matter across the firm."
              : user.role === "SENIOR_ADVOCATE"
                ? "Your matters and those of your team."
                : "Matters you are assigned to."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ViewToggle view={view} />
          {canCreateCases(user.role) ? (
            <Link href="/cases/new" className={buttonClass("primary")}>
              New case
            </Link>
          ) : null}
        </div>
      </header>
      <CaseFilters courts={courts} staff={staff} view={view} />
      {view === "board" ? (
        <KanbanBoard
          grouped={await listCasesByStatus(user, filters)}
          canEdit={canEditCase(user.role)}
        />
      ) : (
        <CaseList user={user} filters={filters} hasFilters={hasFilters} />
      )}
    </div>
  );
}

async function CaseList({
  user,
  filters,
  hasFilters,
}: {
  user: Awaited<ReturnType<typeof requireUser>>;
  filters: Filters;
  hasFilters: boolean;
}) {
  const cases = await listCases(user, filters);

  if (cases.length === 0) {
    return hasFilters ? (
      <EmptyState
        title="No cases match those filters"
        description="Try widening the search, or clear the filters to see everything you have access to."
      />
    ) : (
      <EmptyState
        title="No cases yet"
        description={
          canCreateCases(user.role)
            ? "Create the first matter to get started."
            : "Once a partner assigns you to a matter, it will appear here."
        }
        action={
          canCreateCases(user.role) ? (
            <Link href="/cases/new" className={buttonClass("primary")}>
              New case
            </Link>
          ) : null
        }
      />
    );
  }

  return (
    <>
      <p className="mb-2 text-xs text-muted">
        {" "}
        {cases.length} case{cases.length === 1 ? "" : "s"}
      </p>
      <CaseTable cases={cases} />
    </>
  );
}
