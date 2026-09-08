import { TaskForm } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { canAssignTasks, isAdmin } from "@/lib/auth/roles";
import { requireCaseAccess } from "@/lib/dal";
import { getAssignableStaff, listCaseTasks } from "@/lib/tasks/queries";
import { serverNow } from "@/lib/time";

export default async function CaseTasksPage(
  props: PageProps<"/cases/[id]/tasks">,
) {
  const { id } = await props.params;
  const { user } = await requireCaseAccess(id);
  const now = serverNow();

  const [tasks, staff] = await Promise.all([
    listCaseTasks(id),
    getAssignableStaff(),
  ]);

  const staffOptions = staff.map((s) => ({ id: s.id, label: s.name }));

  return (
    <div className="space-y-5">
      <TaskForm
        staff={staffOptions}
        // The case is fixed on this tab, so it is not offered as a choice.
        cases={[]}
        lockedCaseId={id}
        canAssignOthers={canAssignTasks(user.role)}
        currentUserId={user.id}
      />

      <TaskList
        showCase={false}
        lockedCaseId={id}
        nowMs={now.getTime()}
        currentUserId={user.id}
        isAdminViewer={isAdmin(user.role)}
        canAssignOthers={canAssignTasks(user.role)}
        staff={staffOptions}
        cases={[]}
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
