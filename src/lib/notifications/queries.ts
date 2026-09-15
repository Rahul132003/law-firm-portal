import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { NotificationKind } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/** Notifications belong to one recipient, so scoping is simply `userId`. */

const notificationSelect = {
  id: true,
  kind: true,
  title: true,
  body: true,
  linkUrl: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export async function listNotifications(limit = 30) {
  const user = await requireUser();

  return prisma.notification.findMany({
    where: { userId: user.id },
    select: notificationSelect,
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });
}

export async function countUnreadNotifications(): Promise<number> {
  const user = await requireUser();

  return prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
}

export const NOTIFICATION_PAGE_SIZE = 50;

/**
 * One page of the full notification history, newest first. `before` is the id
 * of the last row on the previous page (keyset pagination, so new arrivals do
 * not shift pages).
 */
export async function listNotificationPage(options: {
  unreadOnly?: boolean;
  kind?: NotificationKind;
  before?: string;
}) {
  const user = await requireUser();

  const where: Prisma.NotificationWhereInput = {
    userId: user.id,
    ...(options.unreadOnly ? { readAt: null } : {}),
    ...(options.kind ? { kind: options.kind } : {}),
  };

  const rows = await prisma.notification.findMany({
    where,
    select: notificationSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: NOTIFICATION_PAGE_SIZE + 1,
    ...(options.before ? { cursor: { id: options.before }, skip: 1 } : {}),
  });

  const hasMore = rows.length > NOTIFICATION_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, NOTIFICATION_PAGE_SIZE) : rows;
  return { rows: page, nextCursor: hasMore ? page[page.length - 1]!.id : null };
}

export async function getMutedKinds(): Promise<NotificationKind[]> {
  const user = await requireUser();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mutedNotificationKinds: true },
  });
  return row?.mutedNotificationKinds ?? [];
}

/**
 * Retention: read notifications older than 90 days, and anything older than a
 * year, are removed. Notifications are prompts, not records — the underlying
 * hearings, tasks and notices keep their own history.
 */
export async function pruneNotifications(now: Date = new Date()): Promise<number> {
  const DAY = 24 * 60 * 60 * 1000;
  const { count } = await prisma.notification.deleteMany({
    where: {
      OR: [
        { readAt: { not: null }, createdAt: { lt: new Date(now.getTime() - 90 * DAY) } },
        { createdAt: { lt: new Date(now.getTime() - 365 * DAY) } },
      ],
    },
  });
  return count;
}
