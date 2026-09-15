"use server";
import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PUSH_DEVICE_COOKIE } from "@/lib/push/subscription";

export async function signOutAction() {
  // Stop pushing to this browser: on a shared computer the next person must
  // not receive the previous user's hearing reminders.
  const cookieStore = await cookies();
  const deviceId = cookieStore.get(PUSH_DEVICE_COOKIE)?.value;
  if (deviceId) {
    await prisma.pushSubscription.deleteMany({ where: { id: deviceId } }).catch(() => {});
    cookieStore.delete(PUSH_DEVICE_COOKIE);
  }

  await signOut({ redirectTo: "/login" });
}
