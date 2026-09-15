import type { NotificationKind } from "@/generated/prisma/enums";
import { NOTIFICATION_KINDS } from "@/lib/notifications/kinds";

/**
 * The JSON a push message carries to the service worker (public/sw.js).
 * Pure, so the privacy rule is unit-tested.
 */
export type PushPayload = {
  title: string;
  body: string;
  /** Portal path opened when the notification is tapped. */
  url: string;
  /**
   * Notifications with the same tag replace each other on the device rather
   * than stacking, e.g. repeated uploads to the same case.
   */
  tag: string;
  /** Hearings and deadlines stay on screen until acted on. */
  requireInteraction: boolean;
};

const STICKY_KINDS: ReadonlySet<NotificationKind> = new Set(["HEARING_REMINDER", "TASK_DUE", "CONFLICT_WAIVED"]);

export function buildPushPayload(
  notification: { kind: NotificationKind; title: string; body: string; linkUrl?: string | null },
  options: { firmName: string; hideDetails: boolean },
): PushPayload {
  const url = notification.linkUrl && notification.linkUrl.startsWith("/") ? notification.linkUrl : "/notifications";

  return {
    // With details hidden, a lock screen shows only the kind of update — no
    // case, client or party names that could be privileged.
    title: options.hideDetails ? `${options.firmName}: ${NOTIFICATION_KINDS[notification.kind].label}` : notification.title,
    body: options.hideDetails ? "Open the portal to see the details." : notification.body,
    url,
    tag: `${notification.kind}:${url}`,
    requireInteraction: STICKY_KINDS.has(notification.kind),
  };
}
