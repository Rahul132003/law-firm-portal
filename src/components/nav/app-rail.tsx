"use client";

import { ChevronsUpDown, Scale } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/nav/sign-out-button";
import type { NavItem } from "@/lib/nav";

import { NavIcon } from "./icons";

/**
 * The application rail — the one deliberately dark surface in an otherwise
 * off-white system. It owns navigation and identity; notifications and the
 * date live in the top bar instead, so nothing is duplicated between them.
 *
 * `collapsed` is controlled from `PortalChrome` rather than owned here, so
 * the top bar's hamburger and the rail's own toggle button drive the same
 * piece of state.
 */
const RAIL_W = "w-[72px]";
const WIDE_W = "w-64";

export function AppRail({
  items,
  firmName,
  user,
  collapsed,
  onToggle,
}: {
  items: NavItem[];
  firmName: string;
  user: { name: string; roleLabel: string; initials: string };
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col bg-rail transition-[width] duration-200 md:flex ${
        collapsed ? RAIL_W : WIDE_W
      }`}
    >
      {/* ── Firm mark ─────────────────────────────────────────────── */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-rail-border ${
          collapsed ? "justify-center px-2" : "gap-3 px-4"
        }`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rail-raised ring-1 ring-rail-border">
          <Scale
            className="size-5 text-rail-accent-ink"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </span>
        {!collapsed ? (
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold uppercase tracking-wide text-rail-ink">
              {firmName}
            </span>
            <span className="block truncate text-[10px] font-medium uppercase tracking-widest text-rail-ink-muted">
              Law Firm
            </span>
          </span>
        ) : null}
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav
        aria-label="Portal sections"
        className={`flex-1 overflow-y-auto py-3 ${collapsed ? "px-2" : "px-3"}`}
      >
        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href} className="group/nav relative">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
                  } ${
                    active
                      ? "bg-rail-accent text-white"
                      : "text-rail-ink-muted hover:bg-rail-raised hover:text-rail-ink"
                  }`}
                >
                  <NavIcon name={item.icon} className={active ? "text-white" : ""} />
                  {!collapsed ? (
                    <span className="truncate">{item.label}</span>
                  ) : null}
                </Link>

                {/* CSS-only tooltip; no JS, no portal, no layout thrash. */}
                {collapsed ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-rail-border bg-rail-raised px-2 py-1 text-xs text-rail-ink opacity-0 shadow-lg transition-opacity group-hover/nav:opacity-100"
                  >
                    {item.label}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Presence, identity, sign out ─────────────────────────── */}
      <div className={`shrink-0 border-t border-rail-border py-3 ${collapsed ? "px-2" : "px-3"}`}>
        {!collapsed ? (
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-rail-accent opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-rail-accent" />
            </span>
            <span className="text-xs font-medium text-rail-ink-muted">
              Online
            </span>
          </div>
        ) : null}

        <div className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((value) => !value)}
            aria-expanded={accountOpen}
            className={`flex w-full items-center rounded-lg transition-colors hover:bg-rail-raised ${
              collapsed ? "justify-center p-1.5" : "gap-2.5 p-1.5"
            }`}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rail-accent text-xs font-bold text-white">
              {user.initials}
            </span>
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-rail-ink">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-rail-ink-muted">
                    {user.roleLabel}
                  </span>
                </span>
                <ChevronsUpDown
                  className="size-4 shrink-0 text-rail-ink-muted"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </>
            ) : null}
          </button>

          {accountOpen ? (
            <div
              className={`absolute bottom-full z-30 mb-2 overflow-hidden rounded-lg border border-rail-border bg-rail-raised py-1 shadow-lg ${
                collapsed ? "left-0 w-44" : "left-0 right-0"
              }`}
            >
              <div className="border-b border-rail-border px-3 py-2">
                <p className="truncate text-sm font-semibold text-rail-ink">
                  {user.name}
                </p>
                <p className="truncate text-xs text-rail-ink-muted">
                  {user.roleLabel}
                </p>
              </div>
              <Link
                href="/profile"
                onClick={() => setAccountOpen(false)}
                className="block px-3 py-2 text-sm text-rail-ink-muted transition-colors hover:bg-rail hover:text-rail-ink"
              >
                My Profile
              </Link>
              <Link
                href="/settings"
                onClick={() => setAccountOpen(false)}
                className="block px-3 py-2 text-sm text-rail-ink-muted transition-colors hover:bg-rail hover:text-rail-ink"
              >
                Settings
              </Link>
              <div className="border-t border-rail-border px-1.5 pt-1.5">
                <SignOutButton className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs font-medium text-rail-ink-muted transition-colors hover:bg-danger-soft hover:text-danger" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
        className="flex h-9 shrink-0 items-center justify-center border-t border-rail-border text-rail-ink-muted transition-colors hover:bg-rail-raised hover:text-rail-ink"
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
