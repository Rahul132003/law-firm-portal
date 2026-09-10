"use client";

import { useState } from "react";

import type { NotificationItem } from "@/components/nav/notification-bell";
import { AppRail } from "@/components/nav/app-rail";
import { TopBar } from "@/components/nav/top-bar";
import type { NavItem } from "@/lib/nav";

const COOKIE = "portal_rail";

function persist(collapsed: boolean) {
  // One year, root path, lax — a UI preference, nothing sensitive.
  document.cookie = `${COOKIE}=${collapsed ? "rail" : "wide"};path=/;max-age=31536000;samesite=lax`;
}

/**
 * Owns the one piece of state the rail and the top bar both need to agree
 * on — whether the rail is collapsed — so the hamburger in the top bar and
 * the toggle button at the foot of the rail never fall out of sync.
 */
export function PortalChrome({
  items,
  firmName,
  user,
  notifications,
  unreadCount,
  nowMs,
  dateLabel,
  initialCollapsed,
  children,
}: {
  items: NavItem[];
  firmName: string;
  user: { name: string; roleLabel: string; initials: string };
  notifications: NotificationItem[];
  unreadCount: number;
  nowMs: number;
  dateLabel: string;
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    setCollapsed((current) => {
      persist(!current);
      return !current;
    });
  }

  return (
    <div className="flex min-h-dvh bg-canvas">
      <AppRail
        items={items}
        firmName={firmName}
        user={user}
        collapsed={collapsed}
        onToggle={toggle}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onToggleRail={toggle}
          dateLabel={dateLabel}
          notifications={notifications}
          unreadCount={unreadCount}
          nowMs={nowMs}
          user={user}
        />

        {children}
      </div>
    </div>
  );
}
