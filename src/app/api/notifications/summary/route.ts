import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Tiny endpoint the bell polls so the unread count stays current without a
 * page navigation. Returns only a count and the newest id — the list itself
 * is re-rendered by the server when the client sees a change.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  // Same liveness check as requireUser, without its HTML redirect.
  const account = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { isActive: true },
  });
  if (!account?.isActive) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const [unreadCount, newest] = await Promise.all([
    prisma.notification.count({ where: { userId: sessionUser.id, readAt: null } }),
    prisma.notification.findFirst({
      where: { userId: sessionUser.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  return NextResponse.json(
    { unreadCount, newestId: newest?.id ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
