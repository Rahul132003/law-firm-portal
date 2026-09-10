"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/nav/icons";

export type SettingsTab = {
  href: string;
  label: string;
  icon: string;
};

/**
 * Tab bar for the settings section.
 *
 * Client-side only so the active tab can be derived from the pathname. Every
 * tab is a real route, so each one still gets its own server render and its
 * own capability check — the tab list is presentation, never the guard.
 */
export function SettingsNav({ tabs }: { tabs: SettingsTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="scroll-x -mb-px flex gap-1 border-b border-hairline"
    >
      {tabs.map((tab) => {
        // `/settings` is a prefix of every other tab, so the hub matches
        // exactly while the rest also match their own nested routes.
        const isActive =
          tab.href === "/settings"
            ? pathname === "/settings"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "flex items-center gap-2 whitespace-nowrap border-b-2 border-accent-600 px-3 py-2.5 text-sm font-medium text-primary"
                : "flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm text-secondary transition-colors hover:text-primary"
            }
          >
            <NavIcon name={tab.icon} className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
