"use server";
import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@/generated/prisma/enums";
import { canAssignTasks, isAdmin } from "@/lib/auth/roles";
import { hasCaseAccess, requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getTaskForAccess } from "./queries";
import { fieldErrors, statusChangeSchema, taskInputSchema } from "./validation";

export type TaskFormState = {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
};

function readForm(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  return {
    description: text("description"),
    assignedToId: text("assignedToId"),
    caseId: text("caseId"),
    dueDate: text("dueDate"),
    status: text("status"),
    kind: text("kind"),
  };
}

export async function createTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();

  const parsed = taskInputSchema.safeParse(readForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const data = parsed.data;

  // Paralegals may keep their own to-do list but not direct other people.
  if (!canAssignTasks(user.role) && data.assignedToId !== user.id) {
    return { message: "Your role cannot assign tasks to other people." };
  }

  // A task may only be attached to a case the creator can actually reach.
  if (data.caseId && !(await hasCaseAccess(user, data.caseId))) {
    return { errors: { caseId: "That case is not available to you." } };
  }

  const assignee = await prisma.user.findFirst({
    where: { id: data.assignedToId, isActive: true },
    select: { id: true },
  });

  if (!assignee) {
    return { errors: { assignedToId: "That person is not an active user." } };
  }

  await prisma.task.create({
    data: {
      description: data.description,
      assignedToId: data.assignedToId,
      createdById: user.id,
      caseId: data.caseId,
      dueDate: data.dueDate,
      status: data.status,
      kind: data.kind,
      completedAt: data.status === "DONE" ? new Date() : null,
    },
  });

  revalidatePath("/tasks");
  if (data.caseId) revalidatePath(`/cases/${data.caseId}/tasks`);
  return { ok: true };
}

export async function updateTask(
  taskId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();

  const existing = await getTaskForAccess(taskId);
  if (!existing) return { message: "That task is not available to you." };

  const parsed = taskInputSchema.safeParse(readForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const data = parsed.data;

  if (!canAssignTasks(user.role) && data.assignedToId !== user.id) {
    return { message: "Your role cannot assign tasks to other people." };
  }

  if (data.caseId && !(await hasCaseAccess(user, data.caseId))) {
    return { errors: { caseId: "That case is not available to you." } };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      description: data.description,
      assignedToId: data.assignedToId,
      caseId: data.caseId,
      dueDate: data.dueDate,
      status: data.status,
      kind: data.kind,
      // Preserve the original completion time when a task stays done.
      completedAt:
        data.status === "DONE" ? (existing.completedAt ?? new Date()) : null,
    },
  });

  revalidatePath("/tasks");
  if (existing.caseId) revalidatePath(`/cases/${existing.caseId}/tasks`);
  if (data.caseId) revalidatePath(`/cases/${data.caseId}/tasks`);
  return { ok: true };
}

/** Quick status toggle from the list, without opening the full form. */
export async function setTaskStatus(
  taskId: string,
  status: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();

  const existing = await getTaskForAccess(taskId);
  if (!existing) {
    return { ok: false, message: "That task is not available to you." };
  }

  // Anyone on the case can move a task along, but only the assignee, the
  // person who raised it, or a partner may do so — a shared case does not
  // make someone else's workload editable.
  const mayChange =
    existing.assignedTo.id === user.id ||
    existing.createdBy?.id === user.id ||
    isAdmin(user.role);

  if (!mayChange) {
    return { ok: false, message: "Only the assignee can change this task." };
  }

  const parsed = statusChangeSchema.safeParse({ taskId, status });
  if (!parsed.success) return { ok: false, message: "Unknown status." };

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: parsed.data.status as TaskStatus,
      completedAt:
        parsed.data.status === "DONE"
          ? (existing.completedAt ?? new Date())
          : null,
    },
  });

  revalidatePath("/tasks");
  if (existing.caseId) revalidatePath(`/cases/${existing.caseId}/tasks`);
  return { ok: true };
}

export async function deleteTask(
  taskId: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();

  const existing = await getTaskForAccess(taskId);
  if (!existing) return { ok: true };

  const mayDelete =
    existing.createdBy?.id === user.id ||
    existing.assignedTo.id === user.id ||
    isAdmin(user.role);

  if (!mayDelete) {
    return { ok: false, message: "You cannot delete this task." };
  }

  await prisma.task.delete({ where: { id: taskId } });

  revalidatePath("/tasks");
  if (existing.caseId) revalidatePath(`/cases/${existing.caseId}/tasks`);
  return { ok: true };
}
