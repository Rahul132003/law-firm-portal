import "server-only";

import { canPostNotices } from "@/lib/auth/roles";
import { requireUser, type SessionUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Read side of the notice board.
 *
 * Notices are firm-wide: there is no case scoping here, because an
 * announcement is addressed to everyone at the firm. The only per-user state
 * is whether *this* reader has acknowledged it.
 */

export type NoticeView = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: Date;
  postedBy: { id: string; name: string };
  readAt: Date | null;
  readCount: number;
  /** Only populated for users who can see receipts. */
  totalRecipients: number;
};

export async function listNotices(user: SessionUser): Promise<NoticeView[]> {
  const [notices, activeStaff] = await Promise.all([
    prisma.notice.findMany({
      select: {
        id: true,
        title: true,
        body: true,
        isPinned: true,
        createdAt: true,
        postedBy: { select: { id: true, name: true } },
        _count: { select: { reads: true } },
        // Just this reader's receipt, not everyone's.
        reads: {
          where: { userId: user.id },
          select: { readAt: true },
          take: 1,
        },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  return notices.map((notice) => ({
    id: notice.id,
    title: notice.title,
    body: notice.body,
    isPinned: notice.isPinned,
    createdAt: notice.createdAt,
    postedBy: notice.postedBy,
    readAt: notice.reads[0]?.readAt ?? null,
    readCount: notice._count.reads,
    totalRecipients: activeStaff,
  }));
}

export async function countUnreadNotices(user: SessionUser): Promise<number> {
  return prisma.notice.count({
    where: { reads: { none: { userId: user.id } } },
  });
}

/**
 * Per-notice read receipts: who has acknowledged and who has not.
 * Restricted to those who can post notices — this is a compliance view, not
 * something every colleague needs.
 */
export async function getNoticeReceipts(noticeId: string) {
  const user = await requireUser();
  if (!canPostNotices(user.role)) return null;

  const notice = await prisma.notice.findUnique({
    where: { id: noticeId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      reads: {
        select: {
          readAt: true,
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { readAt: "asc" },
      },
    },
  });

  if (!notice) return null;

  const readerIds = new Set(notice.reads.map((r) => r.user.id));

  // Deactivated staff are excluded: chasing an acknowledgement from someone
  // who has left the firm is noise.
  const outstanding = await prisma.user.findMany({
    where: { isActive: true, id: { notIn: [...readerIds] } },
    select: { id: true, name: true, role: true },
    orderBy: [{ name: "asc" }],
  });

  return {
    id: notice.id,
    title: notice.title,
    createdAt: notice.createdAt,
    read: notice.reads.map((r) => ({
      user: r.user,
      readAt: r.readAt,
    })),
    outstanding,
  };
}
