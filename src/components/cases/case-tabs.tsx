"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { segment: string; label: string; count?: number };

/**
 * Tab bar for the case detail page. Client-side only so the active tab can be
 * derived from the pathname; every tab is a real route, so each one gets its
 * own server render and its own access check.
 */
export function CaseTabs({ caseId, tabs }: { caseId: string; tabs: Tab[] }) {
  const pathname = usePathname();
  const base = `/cases/${caseId}`;

  return (
    <nav
      aria-label="Case sections"
      className="-mb-px flex gap-1 overflow-x-auto border-b border-hairline"
    >
      {tabs.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const isActive = pathname === href;

        return (
          <Link
            key={tab.segment || "overview"}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "flex items-center gap-1.5 whitespace-nowrap border-b-2 border-accent-600 px-3 py-2.5 text-sm font-medium text-primary"
                : "flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm text-secondary transition-colors hover:text-primary"
            }
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 ? (
              <span className="rounded-full bg-sunken px-1.5 py-px text-[11px] text-secondary">
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
