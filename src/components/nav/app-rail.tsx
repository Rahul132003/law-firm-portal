"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { NotificationItem } from "@/components/nav/notification-bell";
import { NotificationBell } from "@/components/nav/notification-bell";
import { SignOutButton } from "@/components/nav/sign-out-button";
import type { NavItem } from "@/lib/nav";

import { NavIcon } from "./icons";

/**
 * Collapsible application rail.
 *
 * The collapsed/expanded preference is persisted in a cookie rather than
 * localStorage so the server renders the correct width on first paint.
 * Reading localStorage during render would either mismatch hydration or
 * flash the wrong width on every navigation.
 */
const COOKIE = "portal_rail";
const RAIL_W = "w-[68px]";
const WIDE_W = "w-60";

function persist(collapsed: boolean) {
  // One year, root path, lax — a UI preference, nothing sensitive.
  document.cookie = `${COOKIE}=${collapsed ? "rail" : "wide"};path=/;max-age=31536000;samesite=lax`;
}

export function AppRail({
  items,
  user,
  notifications,
  unreadCount,
  nowMs,
  initialCollapsed,
}: {
  items: NavItem[];
  user: { name: string; roleLabel: string; initials: string };
  notifications: NotificationItem[];
  unreadCount: number;
  nowMs: number;
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    setCollapsed((current) => {
      persist(!current);
      return !current;
    });
  }

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-hairline bg-raised transition-[width] duration-200 md:flex ${
        collapsed ? RAIL_W : WIDE_W
      }`}
    >
      {/* ── Firm mark ─────────────────────────────────────────────── */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-hairline ${
          collapsed ? "justify-center px-2" : "gap-3 px-4"
        }`}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-700 font-serif text-sm font-semibold text-white">
          {user.initials}
        </span>
        {!collapsed ? (
          <span className="min-w-0">
            <span className="block truncate font-serif text-sm font-semibold text-primary">
              {user.name}
            </span>
            <span className="block truncate text-[11px] text-muted">
              {user.roleLabel}
            </span>
          </span>
        ) : null}
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav
        aria-label="Portal sections"
        className={`flex-1 overflow-y-auto py-3 ${collapsed ? "px-2" : "px-3"}`}
      >
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href} className="group/nav relative">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-md text-sm transition-colors ${
                    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2"
                  } ${
                    active
                      ? "bg-accent-50 font-medium text-accent-800"
                      : "text-secondary hover:bg-sunken hover:text-primary"
                  }`}
                >
                  {/* Active state is carried by a rule + tint, not an
                      inverted block — quieter, and it still reads when
                      collapsed. */}
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent-600"
                    />
                  ) : null}
                  <NavIcon name={item.icon} />
                  {!collapsed ? (
                    <span className="truncate">{item.label}</span>
                  ) : null}
                </Link>

                {/* CSS-only tooltip; no JS, no portal, no layout thrash. */}
                {collapsed ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-hairline bg-primary px-2 py-1 text-xs text-white opacity-0 shadow-sm transition-opacity group-hover/nav:opacity-100"
                  >
                    {item.label}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Notifications ─────────────────────────────────────────── */}
      <div className={`border-t border-hairline py-2 ${collapsed ? "px-2" : "px-3"}`}>
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          nowMs={nowMs}
          collapsed={collapsed}
        />
      </div>

      {/* ── Account + collapse control ────────────────────────────── */}
      <div
        className={`flex shrink-0 items-center border-t border-hairline py-3 ${
          collapsed ? "flex-col gap-2 px-2" : "justify-between gap-2 px-3"
        }`}
      >
        {collapsed ? (
          <>
            <Link
              href="/settings"
              aria-label="Your account"
              title="Your account"
              className="rounded-md p-2 text-secondary hover:bg-sunken hover:text-primary"
            >
              <NavIcon name="settings" />
            </Link>
            <SignOutButton showLabel={false} />
          </>
        ) : (
          <>
            <Link
              href="/settings"
              className="text-xs font-medium text-secondary hover:text-primary"
            >
              Account
            </Link>
            <SignOutButton />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
        className="flex h-9 shrink-0 items-center justify-center border-t border-hairline text-muted transition-colors hover:bg-sunken hover:text-primary"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`size-4 transition-transform duration-200 ${
            collapsed ? "rotate-180" : ""
          }`}
        >
          <path d="M12 5 7 10l5 5" />
        </svg>
      </button>
    </aside>
  );
}
