"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavItem } from "@/lib/nav";

import { NavIcon } from "./icons";

/**
 * Mobile navigation: a horizontally scrolling strip under the header.
 *
 * A drawer would hide the section list behind a tap; with eight or nine
 * destinations a visible scroll strip keeps them one tap away, and the
 * active item scrolls into view on its own because it is a real anchor.
 */
export function MobileNav({
  items,
  unreadCount,
}: {
  items: NavItem[];
  unreadCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Portal sections"
      className="scroll-x sticky top-[53px] z-10 flex gap-1 border-b border-hairline bg-raised px-3 py-2 md:hidden"
    >
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
              active
                ? "bg-accent-50 font-medium text-accent-800"
                : "text-secondary hover:bg-sunken"
            }`}
          >
            <NavIcon name={item.icon} className="size-4" />
            <span>{item.label}</span>
            {item.href === "/notices" && unreadCount > 0 ? (
              <span className="grid min-w-4 place-items-center rounded-full bg-accent-700 px-1 text-[10px] font-semibold text-white">
                {unreadCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
