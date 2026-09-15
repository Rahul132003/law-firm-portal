import type { Metadata } from "next";
import { Bell, Smartphone } from "lucide-react";
import { cookies } from "next/headers";

import { DeviceSettings } from "@/components/notifications/device-settings";
import { PreferencesForm } from "@/components/notifications/preferences-form";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { NOTIFICATION_KINDS, NOTIFICATION_KIND_ORDER } from "@/lib/notifications/kinds";
import { getMutedKinds } from "@/lib/notifications/queries";
import { prisma } from "@/lib/prisma";
import { PUSH_DEVICE_COOKIE } from "@/lib/push/subscription";

export const metadata: Metadata = {
  title: `Notifications · ${FIRM_NAME}`,
};

export default async function SettingsNotificationsPage() {
  const user = await requireUser();
  const [muted, account, cookieStore] = await Promise.all([
    getMutedKinds(),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        pushHideDetails: true,
        pushSubscriptions: {
          select: { id: true, deviceName: true, lastSeenAt: true },
          orderBy: { lastSeenAt: "desc" },
        },
      },
    }),
    cookies(),
  ]);

  const thisDeviceId = cookieStore.get(PUSH_DEVICE_COOKIE)?.value;
  const devices = (account?.pushSubscriptions ?? []).map((d) => ({ ...d, isThisDevice: d.id === thisDeviceId }));

  const kinds = NOTIFICATION_KIND_ORDER.filter(
    (kind) => NOTIFICATION_KINDS[kind].audience?.(user.role) ?? true,
  );

  return (
    <div className="space-y-6">
      <section className="surface-card p-6 md:p-8">
        <div className="mb-5 flex items-center gap-3 border-b border-hairline pb-4">
          <div className="rounded-xl bg-sunken p-2 text-secondary">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-base font-bold text-primary">Phone &amp; desktop alerts</h2>
            <p className="text-xs text-muted">
              Get notified on your devices even when the portal is closed. Every kind you leave on below is sent.
            </p>
          </div>
        </div>
        <DeviceSettings
          devices={devices}
          hideDetails={account?.pushHideDetails ?? false}
          registeredOnServer={devices.some((d) => d.isThisDevice)}
        />
      </section>

      <section className="surface-card p-6 md:p-8">
        <div className="mb-5 flex items-center gap-3 border-b border-hairline pb-4">
          <div className="rounded-xl bg-sunken p-2 text-secondary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-base font-bold text-primary">What to notify me about</h2>
            <p className="text-xs text-muted">Applies to the notification bell and to your devices.</p>
          </div>
        </div>
        <PreferencesForm kinds={kinds} muted={muted} />
      </section>
    </div>
  );
}
