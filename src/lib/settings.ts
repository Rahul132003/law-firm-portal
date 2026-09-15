import type { SettingsTab } from "@/components/settings/settings-nav";
import type { Role } from "@/generated/prisma/enums";
import { canManageUsers } from "@/lib/auth/roles";

/**
 * Settings information architecture.
 *
 * Mirrors src/lib/nav.ts: the predicate lives here, on the server, and only
 * the serializable tab shape crosses to the client tab bar. The list is
 * presentation — each settings route still runs its own capability check.
 */
type SettingsDefinition = SettingsTab & {
  visible?: (role: Role) => boolean;
};

const SETTINGS_DEFINITIONS: readonly SettingsDefinition[] = [
  {
    href: "/settings",
    label: "Account",
    icon: "user",
  },
  {
    href: "/settings/security",
    label: "Security",
    icon: "key",
  },
  {
    href: "/settings/notifications",
    label: "Notifications",
    icon: "bell",
  },
  {
    href: "/settings/team",
    label: "Team & access",
    icon: "users",
    visible: canManageUsers,
  },
  {
    href: "/settings/firm",
    label: "Firm",
    icon: "building",
    visible: canManageUsers,
  },
];

export function settingsTabsForRole(role: Role): SettingsTab[] {
  return SETTINGS_DEFINITIONS.filter((tab) => tab.visible?.(role) ?? true).map(
    ({ href, label, icon }) => ({ href, label, icon }),
  );
}
