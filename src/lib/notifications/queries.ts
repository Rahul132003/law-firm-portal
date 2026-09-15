import "server-only";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/** Notifications belong to one recipient, so scoping is simply `userId`. */

export async function listNotifications(limit = 30) {
  const user = await requireUser();

  return prisma.notification.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      linkUrl: true,
      readAt: true,
      createdAt: true,
    },
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
