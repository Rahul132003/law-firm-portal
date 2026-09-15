import type { Role } from "@/generated/prisma/enums";
import { canViewReports } from "@/lib/auth/roles";

/**
 * Portal information architecture.
 *
 * `ready` reflects the staged build order from the project brief. Items that
 * are not built yet still appear, greyed out, so the shape of the product is
 * legible — rather than silently 404-ing.
 */
/** Server-side definition. `visible` is a function and must not cross to the client. */
type NavDefinition = {
  href: string;
  label: string;
  icon: string;
  ready: boolean;
  visible?: (role: Role) => boolean;
};

/**
 * The serializable shape handed to the client sidebar. Deliberately omits
 * `visible` — passing a function into a Client Component is a runtime error.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  ready: boolean;
};

const NAV_DEFINITIONS: readonly NavDefinition[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home", ready: true },
  { href: "/cases", label: "Cases", icon: "folder", ready: true },
  { href: "/clients", label: "Clients", icon: "users", ready: true },
  { href: "/documents", label: "Documents", icon: "file", ready: true },
  { href: "/diary", label: "Court Diary", icon: "calendar", ready: true },
  { href: "/tasks", label: "Tasks", icon: "check", ready: true },
  { href: "/time", label: "Time", icon: "clock", ready: true },
  { href: "/notices", label: "Notice Board", icon: "megaphone", ready: true },
  {
    href: "/reports",
    label: "Reports",
    icon: "chart",
    ready: true,
    visible: canViewReports,
  },
  { href: "/profile", label: "My Profile", icon: "user", ready: true },
  { href: "/settings", label: "Settings", icon: "settings", ready: true },
];

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_DEFINITIONS.filter((item) => item.visible?.(role) ?? true).map(
    // Strip `visible` rather than spreading the whole object, so the result
    // stays serializable across the server/client boundary.
    ({ href, label, icon, ready }) => ({ href, label, icon, ready }),
  );
}
