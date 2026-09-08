import type { Metadata } from "next";
import Link from "next/link";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import type { TaskStatus } from "@/generated/prisma/enums";
import { canAssignTasks, isAdmin } from "@/lib/auth/roles";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import {
  getAssignableCases,
  getAssignableStaff,
  getMyTaskCounts,
  listMyTasks,
  listTasks,
  type TaskFilters,
} from "@/lib/tasks/queries";
import { TASK_STATUS_ORDER } from "@/lib/tasks/constants";
import { serverNow } from "@/lib/time";

export const metadata: Metadata = {
  title: `Tasks · ${FIRM_NAME}`,
};

function first(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single && single.trim() !== "" ? single : undefined;
}

function Tile({
  label,
  value,
  tone = "",
  href,
}: {
  label: string;
  value: number;
  tone?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="card px-4 py-3 transition-colors hover:bg-sunken"
    >
      <span
        className={`block text-2xl font-semibold ${tone || "text-primary"}`}
      >
        {value}
      </span>
      <span className="mt-0.5 block text-xs text-secondary">{label}</span>
    </Link>
  );
}

export default async function TasksPage(props: PageProps<"/tasks">) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const now = serverNow();

  const scopeParam = first(searchParams, "scope");
  const showAll = scopeParam === "all";
  const statusParam = first(searchParams, "status");
  const filters: TaskFilters = {
    status:
      statusParam &&
      (TASK_STATUS_ORDER as readonly string[]).includes(statusParam)
        ? (statusParam as TaskStatus)
        : undefined,
    deadlinesOnly: first(searchParams, "kind") === "deadlines",
    overdueOnly: first(searchParams, "due") === "overdue",
  };

  const [tasks, counts, staff, cases] = await Promise.all([
    showAll ? listTasks(user, filters, now) : listMyTasks(user, filters, now),
    getMyTaskCounts(user, now),
    getAssignableStaff(),
    getAssignableCases(user),
  ]);

  const open =
    counts.byStatus.TODO +
    counts.byStatus.IN_PROGRESS +
    counts.byStatus.BLOCKED;

  const base = showAll ? "/tasks?scope=all" : "/tasks?";

  return (
    <div className="mx-auto max-w-5xl">
      {" "}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {showAll
              ? "Every task across the matters you can see."
              : "Your personal workload."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Task scope"
            className="inline-flex rounded-lg border border-hairline bg-raised p-0.5"
          >
            <Link
              href="/tasks"
              aria-current={!showAll ? "page" : undefined}
              className={
                !showAll
                  ? "rounded-md bg-ink-900 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-md px-3 py-1 text-xs font-medium text-secondary hover:text-primary"
              }
            >
              Mine
            </Link>
            <Link
              href="/tasks?scope=all"
              aria-current={showAll ? "page" : undefined}
              className={
                showAll
                  ? "rounded-md bg-ink-900 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-md px-3 py-1 text-xs font-medium text-secondary hover:text-primary"
              }
            >
              Everyone
            </Link>
          </div>
        </div>
      </header>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {" "}
        <Tile label="Open" value={open} href="/tasks" />
        <Tile
          label="Overdue"
          value={counts.overdue}
          tone={counts.overdue > 0 ? "text-red-700" : ""}
          href="/tasks?due=overdue"
        />
        <Tile
          label="Due in 7 days"
          value={counts.dueSoon}
          tone={counts.dueSoon > 0 ? "text-orange-700" : ""}
          href="/tasks"
        />
        <Tile
          label="Done"
          value={counts.byStatus.DONE}
          href="/tasks?status=DONE"
        />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
        <Link
          href={showAll ? "/tasks?scope=all" : "/tasks"}
          className="rounded-md border border-hairline px-2 py-1 text-secondary hover:bg-sunken"
        >
          All
        </Link>
        <Link
          href={`${base}&due=overdue`}
          className="rounded-md border border-hairline px-2 py-1 text-secondary hover:bg-sunken"
        >
          Overdue
        </Link>
        <Link
          href={`${base}&kind=deadlines`}
          className="rounded-md border border-hairline px-2 py-1 text-secondary hover:bg-sunken"
        >
          Deadlines only
        </Link>
        {TASK_STATUS_ORDER.map((status) => (
          <Link
            key={status}
            href={`${base}&status=${status}`}
            className="rounded-md border border-hairline px-2 py-1 text-secondary hover:bg-sunken"
          >
            {status === "TODO"
              ? "To do"
              : status === "IN_PROGRESS"
                ? "In progress"
                : status === "BLOCKED"
                  ? "Blocked"
                  : "Done"}
          </Link>
        ))}
      </div>
      <div className="mb-5">
        <TaskForm
          staff={staff.map((s) => ({ id: s.id, label: s.name }))}
          cases={cases.map((c) => ({
            id: c.id,
            label: `${c.caseNumber} — ${c.title}`,
          }))}
          canAssignOthers={canAssignTasks(user.role)}
          currentUserId={user.id}
        />
      </div>
      <p className="mb-2 text-xs text-muted">
        {" "}
        {tasks.length} task{tasks.length === 1 ? "" : "s"}
      </p>
      <TaskList
        nowMs={now.getTime()}
        currentUserId={user.id}
        isAdminViewer={isAdmin(user.role)}
        canAssignOthers={canAssignTasks(user.role)}
        staff={staff.map((s) => ({ id: s.id, label: s.name }))}
        cases={cases.map((c) => ({
          id: c.id,
          label: `${c.caseNumber} — ${c.title}`,
        }))}
        tasks={tasks.map((task) => ({
          id: task.id,
          description: task.description,
          dueDate: task.dueDate,
          status: task.status,
          kind: task.kind,
          assignedTo: task.assignedTo,
          createdBy: task.createdBy,
          caseRef: task.case
            ? {
                id: task.case.id,
                caseNumber: task.case.caseNumber,
                title: task.case.title,
              }
            : null,
        }))}
      />
    </div>
  );
}
