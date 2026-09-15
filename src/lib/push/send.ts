import "server-only";
import webpush from "web-push";

import type { NotificationKind } from "@/generated/prisma/enums";
import { FIRM_NAME } from "@/lib/firm";
import { prisma } from "@/lib/prisma";
import { buildPushPayload } from "./payload";

/**
 * Web Push delivery to phones and desktops, including when the portal is not
 * open. Best effort by design: the in-app notification row is the record, so
 * a push that fails is logged and never fails the caller.
 *
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.
 * Without them push is simply off.
 */

let configured: boolean | null = null;

export function isPushConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    configured = false;
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (error) {
    console.error("Invalid VAPID configuration; push notifications are disabled", error);
    configured = false;
  }
  return configured;
}

export type PushableNotification = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  linkUrl?: string | null;
};

/** Sends each notification to every device its recipient has registered. */
export async function sendPush(notifications: PushableNotification[]): Promise<void> {
  if (notifications.length === 0 || !isPushConfigured()) return;

  const userIds = [...new Set(notifications.map((n) => n.userId))];
  const users = await prisma.user.findMany({
    // Deactivated staff get nothing, even from scheduled reminders.
    where: { id: { in: userIds }, isActive: true },
    select: {
      id: true,
      pushHideDetails: true,
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
    },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const expired: string[] = [];

  await Promise.all(
    notifications.flatMap((notification) => {
      const user = byId.get(notification.userId);
      if (!user) return [];

      const payload = JSON.stringify(
        buildPushPayload(notification, { firmName: FIRM_NAME, hideDetails: user.pushHideDetails }),
      );

      return user.pushSubscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
            // Hearing reminders are useless a day late; drop undelivered ones.
            { TTL: 24 * 60 * 60, urgency: "high", timeout: 10_000 },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410: the browser unsubscribed or the app was uninstalled.
          if (status === 404 || status === 410) expired.push(subscription.id);
          else console.error(`Push to subscription ${subscription.id} failed`, status ?? error);
        }
      });
    }),
  );

  if (expired.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } }).catch(() => {});
  }
}
