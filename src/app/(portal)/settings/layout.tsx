import type { Metadata } from "next";

import { SettingsNav } from "@/components/settings/settings-nav";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { settingsTabsForRole } from "@/lib/settings";

export const metadata: Metadata = {
  title: `Settings · ${FIRM_NAME}`,
};

/**
 * Shell for the settings section.
 *
 * `requireUser()` here only decides which tabs to draw. It is not the
 * security boundary — a layout does not re-run on every child navigation, so
 * the admin-only pages under this one each call `requireCapability` again.
 */
export default async function SettingsLayout({
  children,
}: LayoutProps<"/settings">) {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-primary md:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your credentials and, for partners, the firm&rsquo;s accounts and
          access — all in one place for {FIRM_NAME}.
        </p>
      </header>

      <SettingsNav tabs={settingsTabsForRole(user.role)} />

      {children}
    </div>
  );
}
