import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { PreferencesForm } from "@/components/notifications/preferences-form";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { NOTIFICATION_KINDS, NOTIFICATION_KIND_ORDER } from "@/lib/notifications/kinds";
import { getMutedKinds } from "@/lib/notifications/queries";

export const metadata: Metadata = {
  title: `Notifications · ${FIRM_NAME}`,
};

export default async function SettingsNotificationsPage() {
  const user = await requireUser();
  const muted = await getMutedKinds();

  const kinds = NOTIFICATION_KIND_ORDER.filter(
    (kind) => NOTIFICATION_KINDS[kind].audience?.(user.role) ?? true,
  );

  return (
    <section className="surface-card p-6 md:p-8">
      <div className="mb-5 flex items-center gap-3 border-b border-hairline pb-4">
        <div className="rounded-xl bg-sunken p-2 text-secondary">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-base font-bold text-primary">Notifications</h2>
          <p className="text-xs text-muted">Choose what appears in your notification bell.</p>
        </div>
      </div>

      <PreferencesForm kinds={kinds} muted={muted} />
    </section>
  );
}
