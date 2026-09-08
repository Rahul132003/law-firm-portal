"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";
import { NavIcon } from "./icons";

/**
 * Client component purely so the active route can be highlighted; the item
 * list itself is computed on the server from the user's role.
 */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1.5">
      <p className="px-4 pb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
        Main Menu
      </p>
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        if (!item.ready) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title="Not built yet"
              className="flex cursor-not-allowed items-center gap-3.5 rounded-2xl px-4 py-3 text-base font-bold text-slate-400 opacity-60"
            >
              <NavIcon name={item.icon} className="size-5 text-slate-400" />
              <span className="flex-1">{item.label}</span>
              <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Soon
              </span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "flex items-center gap-3.5 rounded-2xl bg-amber-100/80 border-l-4 border-amber-500 px-4 py-3 text-base font-extrabold text-amber-950 shadow-xs transition-all"
                : "flex items-center gap-3.5 rounded-2xl px-4 py-3 text-base font-bold text-slate-600 transition-all hover:bg-slate-100/80 hover:text-slate-900"
            }
          >
            <NavIcon name={item.icon} className={isActive ? "text-amber-700 size-5" : "text-slate-400 size-5"} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
