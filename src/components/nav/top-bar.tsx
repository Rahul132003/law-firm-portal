"use client";

import { CalendarDays, PanelLeft } from "lucide-react";

import { AccountMenu } from "@/components/nav/account-menu";
import type { NotificationItem } from "@/components/nav/notification-bell";
import { NotificationBell } from "@/components/nav/notification-bell";

/**
 * Desktop-only top bar. Everything on it is one click deeper than the rail —
 * the hamburger drives the same collapse state the rail's own toggle does,
 * so the two controls never disagree.
 */
export function TopBar({
  onToggleRail,
  dateLabel,
  notifications,
  unreadCount,
  nowMs,
  user,
}: {
  onToggleRail: () => void;
  dateLabel: string;
  notifications: NotificationItem[];
  unreadCount: number;
  nowMs: number;
  user: { name: string; roleLabel: string; initials: string };
}) {
  return (
    <header className="sticky top-0 z-20 hidden h-16 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-raised px-6 md:flex">
      <button
        type="button"
        onClick={onToggleRail}
        aria-label="Toggle navigation"
        title="Toggle navigation"
        className="rounded-md p-2 text-secondary transition-colors hover:bg-sunken hover:text-primary"
      >
        <PanelLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </button>

      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-hairline bg-sunken px-3 py-1.5 text-xs font-medium text-secondary lg:flex">
          <CalendarDays
            className="size-3.5 text-accent-700"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {dateLabel}
        </span>

        {/* `collapsed` here means icon-only, not "few notifications" — the
            bell's rail styling (a full-width row with a text label) does not
            fit a horizontal bar, so the top bar always uses the compact
            presentation regardless of the rail's own collapse state. */}
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          nowMs={nowMs}
          collapsed
          openDirection="down"
        />

        <AccountMenu user={user} />
      </div>
    </header>
  );
}
