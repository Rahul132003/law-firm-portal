"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * `updateMany` with the userId in the WHERE clause, rather than a lookup then
 * an update: a notification belonging to someone else simply matches zero
 * rows, so there is no way to mark another user's notifications read.
 */
export async function markNotificationRead(id: string): Promise<void> {
  const user = await requireUser();

  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser();

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/", "layout");
}
