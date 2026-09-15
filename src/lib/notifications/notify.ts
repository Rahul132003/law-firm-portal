import "server-only";
import type { NotificationKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { deliverBatch } from "./deliver";
import { wantsKind } from "./kinds";

/**
 * Event notifications ("someone did something that concerns you").
 *
 * Every activity-driven notification goes through here so the same rules apply
 * everywhere:
 *   - the person who did the thing is never told about it;
 *   - deactivated users are skipped;
 *   - muted kinds are honoured, except mandatory ones;
 *   - duplicate recipients collapse to one row.
 *
 * Notifying is a side effect of a change that has already been saved, so a
 * failure is logged and swallowed rather than surfaced as a failed save.
 */
export async function notify(event: {
  kind: NotificationKind;
  recipientIds: Iterable<string>;
  actorId: string | null;
  title: string;
  body: string;
  linkUrl?: string | null;
}): Promise<number> {
  try {
    const ids = [...new Set(event.recipientIds)].filter((id) => id !== event.actorId);
    if (ids.length === 0) return 0;

    const recipients = await prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, mutedNotificationKinds: true },
    });

    const wanted = recipients.filter((r) => wantsKind(event.kind, r.mutedNotificationKinds));

    return await deliverBatch(
      wanted.map((recipient) => ({
        userId: recipient.id,
        kind: event.kind,
        title: event.title.slice(0, 200),
        body: event.body.slice(0, 1000),
        linkUrl: event.linkUrl ?? null,
      })),
    );
  } catch (error) {
    console.error(`Could not send ${event.kind} notifications`, error);
    return 0;
  }
}

/** Everyone currently assigned to a case. */
export async function caseTeamIds(caseId: string): Promise<string[]> {
  const rows = await prisma.caseAssignment.findMany({
    where: { caseId },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}
