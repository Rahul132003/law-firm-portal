"use server";
import { revalidatePath } from "next/cache";
import type { NotificationKind } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { NOTIFICATION_KIND_ORDER, isMandatoryKind } from "./kinds";

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

/** Deletes one of the caller's own notifications. */
export async function dismissNotification(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.notification.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}

/**
 * Saves which notification kinds the caller has turned off. Anything that is
 * not a real, non-mandatory kind is dropped, so a hand-crafted request cannot
 * mute hearing reminders.
 */
export async function saveNotificationPreferences(
  enabledKinds: string[],
): Promise<{ ok: boolean }> {
  const user = await requireUser();

  const enabled = new Set(enabledKinds);
  const muted: NotificationKind[] = NOTIFICATION_KIND_ORDER.filter(
    (kind) => !isMandatoryKind(kind) && !enabled.has(kind),
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { mutedNotificationKinds: muted },
  });

  revalidatePath("/settings/notifications");
  return { ok: true };
}
