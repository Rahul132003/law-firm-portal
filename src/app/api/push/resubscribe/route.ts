import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pushSubscriptionSchema } from "@/lib/push/subscription";

/**
 * Called by the service worker when the browser rotates a push subscription.
 * Only replaces a subscription the signed-in user already owned, so it cannot
 * be used to attach a device to someone else.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  oldEndpoint: z.string().max(1000),
  subscription: pushSubscriptionSchema,
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });

  const { oldEndpoint, subscription } = parsed.data;
  const { count } = await prisma.pushSubscription.updateMany({
    where: { endpoint: oldEndpoint, userId: user.id },
    data: {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ ok: count > 0 });
}
