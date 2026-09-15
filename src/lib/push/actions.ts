"use server";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { prisma } from "@/lib/prisma";

import { isPushConfigured, sendPush } from "./send";
import { PUSH_DEVICE_COOKIE, describeDevice, pushSubscriptionSchema } from "./subscription";

/**
 * Registers (or re-registers) this browser for push. A subscription endpoint
 * identifies one browser profile, so if a different person signed in on the
 * same device earlier, the device moves to whoever is signed in now.
 */
export async function savePushSubscription(input: unknown): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  if (!isPushConfigured()) {
    return { ok: false, message: "Device notifications are not configured on the server yet." };
  }

  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "This browser's push service is not supported." };

  const { endpoint, keys } = parsed.data;
  const deviceName = describeDevice((await headers()).get("user-agent") ?? "");

  const row = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: user.id, deviceName },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: user.id, deviceName, lastSeenAt: new Date() },
    select: { id: true },
  });

  (await cookies()).set(PUSH_DEVICE_COOKIE, row.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/settings/notifications");
  return { ok: true };
}

/** Stops push to this browser only. */
export async function removeThisDevice(endpoint: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  (await cookies()).delete(PUSH_DEVICE_COOKIE);
  revalidatePath("/settings/notifications");
  return { ok: true };
}

/** Removes one of the caller's devices from the settings list. */
export async function removeDevice(subscriptionId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await prisma.pushSubscription.deleteMany({ where: { id: subscriptionId, userId: user.id } });
  revalidatePath("/settings/notifications");
  return { ok: true };
}

export async function setPushHideDetails(hide: boolean): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { pushHideDetails: hide === true } });
  revalidatePath("/settings/notifications");
  return { ok: true };
}

/** Sends a test push to every device the caller has registered. */
export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (!isPushConfigured()) {
    return { ok: false, message: "Device notifications are not configured on the server yet." };
  }

  const devices = await prisma.pushSubscription.count({ where: { userId: user.id } });
  if (devices === 0) return { ok: false, message: "No devices are registered yet. Turn notifications on first." };

  await sendPush([
    {
      userId: user.id,
      kind: "NOTICE_POSTED",
      title: `${FIRM_NAME}: notifications are working`,
      body: "You will be alerted here about hearings, deadlines and updates on your cases.",
      linkUrl: "/settings/notifications",
    },
  ]);
  return { ok: true, message: `Test sent to ${devices} device${devices === 1 ? "" : "s"}.` };
}
