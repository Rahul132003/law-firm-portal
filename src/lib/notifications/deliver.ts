import "server-only";
import type { NotificationKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Notification delivery.
 *
 * Channels are split by how badly a failure matters:
 *
 * - **in-app is primary.** It is the record that the recipient was told
 *   something. If it fails, the notification did not happen, and callers must
 *   be able to see that — a reminder sweep that reports success while writing
 *   nothing is worse than one that reports failure.
 * - **outbound channels are best-effort.** A bounced email must not cost the
 *   in-app record or abort a batch, so those failures are logged and
 *   swallowed.
 *
 * Email is not wired up; `emailChannel` is a stub. Adding a provider means * implementing `send` here, with no change to any caller.
 */

export type OutboundNotification = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  linkUrl?: string | null;
};

export interface NotificationChannel {
  readonly name: string;
  send(notification: OutboundNotification): Promise<void>;
}

/** Primary channel. The in-app bell reads these rows. */
const inAppChannel: NotificationChannel = {
  name: "in-app",
  async send(notification) {
    await prisma.notification.create({
      data: {
        userId: notification.userId,
        kind: notification.kind,
        title: notification.title,
        body: notification.body,
        linkUrl: notification.linkUrl ?? null,
      },
    });
  },
};

/**
 * Placeholder outbound channel. Deliberately unimplemented: wiring a real
 * provider needs credentials this project does not have.
 */
const emailChannel: NotificationChannel = {
  name: "email",
  async send(notification) {
    console.info(
      `[email:not-configured] would notify ${notification.userId}: ${notification.title}`,
    );
  },
};

function auxiliaryChannels(): NotificationChannel[] {
  // Enabling one is a matter of setting the env var once `send` is real.
  return process.env.NOTIFY_EMAIL_ENABLED === "true" ? [emailChannel] : [];
}

/**
 * Returns whether the notification was actually recorded. Callers that report
 * counts must use this rather than assuming success.
 */
export async function deliver(
  notification: OutboundNotification,
): Promise<boolean> {
  let delivered = false;

  try {
    await inAppChannel.send(notification);
    delivered = true;
  } catch (error) {
    // Loud: this means a recipient was not told something they should be.
    console.error(
      `In-app notification failed for user ${notification.userId}`,
      error,
    );
  }

  await Promise.all(
    auxiliaryChannels().map(async (channel) => {
      try {
        await channel.send(notification);
      } catch (error) {
        console.error(`Notification channel "${channel.name}" failed`, error);
      }
    }),
  );

  return delivered;
}

/**
 * Records many in-app notifications in one query, for fan-out events such as a
 * firm-wide notice. Returns how many rows were written; on failure nothing is
 * written and the error propagates, so callers can tell.
 */
export async function deliverBatch(
  notifications: OutboundNotification[],
): Promise<number> {
  if (notifications.length === 0) return 0;

  const { count } = await prisma.notification.createMany({
    data: notifications.map((n) => ({
      userId: n.userId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      linkUrl: n.linkUrl ?? null,
    })),
  });

  const outbound = auxiliaryChannels();
  if (outbound.length > 0) {
    await Promise.all(
      notifications.flatMap((notification) =>
        outbound.map(async (channel) => {
          try {
            await channel.send(notification);
          } catch (error) {
            console.error(`Notification channel "${channel.name}" failed`, error);
          }
        }),
      ),
    );
  }

  return count;
}

/** Returns how many of the batch were actually recorded. */
export async function deliverMany(
  notifications: OutboundNotification[],
): Promise<number> {
  let delivered = 0;
  for (const notification of notifications) {
    if (await deliver(notification)) delivered += 1;
  }
  return delivered;
}
