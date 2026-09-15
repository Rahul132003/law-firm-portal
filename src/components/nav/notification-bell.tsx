"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/actions";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
};

function relativeTime(value: Date, nowMs: number): string {
  const minutes = Math.round((nowMs - value.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationBell({
  notifications,
  unreadCount,
  nowMs,
  collapsed = false,
  openDirection = "up",
}: {
  notifications: NotificationItem[];
  unreadCount: number;
  /** Server render time; keeps relative labels stable across hydration. */
  nowMs: number;
  /** Icon-only presentation for the collapsed rail. */
  collapsed?: boolean;
  /**
   * Which way the panel unfolds from the trigger. "up" suits the rail, where
   * the bell sits near the bottom of the screen; "down" suits the top bar,
   * where opening upward would push the panel off the top of the viewport.
   */
  openDirection?: "up" | "down";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        title={collapsed ? "Notifications" : undefined}
        className={`relative flex w-full items-center rounded-md text-xs text-secondary transition-colors hover:bg-sunken hover:text-primary ${collapsed ? "justify-center py-2.5" : "gap-2 px-2 py-2"}`}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className="size-4"
        >
          <path d="M6 8a4 4 0 1 1 8 0c0 3 1 4.5 1.5 5h-11C5 12.5 6 11 6 8Z" />{" "}
          <path d="M8.5 15.5a1.5 1.5 0 0 0 3 0" />
        </svg>
        {!collapsed ? <span>Notifications</span> : null}
        {unreadCount > 0 ? (
          collapsed ? (
            // Corner dot: a full count will not fit a 68px rail.
            <span
              aria-hidden="true"
              className="absolute right-2 top-1.5 size-2 rounded-full border border-raised bg-danger"
            />
          ) : (
            <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-accent-700 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )
        ) : null}
      </button>

      {open ? (
        <div
          className={`absolute z-30 max-h-96 w-72 overflow-y-auto rounded-lg border border-hairline bg-raised shadow-lg ${
            openDirection === "up"
              ? "bottom-full left-0 mb-2"
              : "right-0 top-full mt-2"
          }`}
        >
          {" "}
          <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
            {" "}
            <span className="text-xs font-semibold text-primary">
              Notifications
            </span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await markAllNotificationsRead();
                    router.refresh();
                  })
                }
                className="text-[11px] text-secondary hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted">
              Nothing yet.
            </p>
          ) : (
            <ul>
              {notifications.map((item) => {
                const content = (
                  <>
                    <span className="flex items-start gap-2">
                      {!item.readAt ? (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-600"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-1.5 shrink-0"
                        />
                      )}
                      <span className="min-w-0">
                        {" "}
                        <span className="block text-xs font-medium text-primary">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-secondary">
                          {item.body}
                        </span>
                        <span className="mt-1 block text-[10px] text-muted">
                          {relativeTime(item.createdAt, nowMs)}
                        </span>
                      </span>
                    </span>
                  </>
                );

                return (
                  <li
                    key={item.id}
                    className="border-b border-hairline last:border-0"
                  >
                    {item.linkUrl ? (
                      <Link
                        href={item.linkUrl}
                        onClick={() => {
                          setOpen(false);
                          startTransition(() => markNotificationRead(item.id));
                        }}
                        className="block px-3 py-2.5 hover:bg-sunken"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          startTransition(async () => {
                            await markNotificationRead(item.id);
                            router.refresh();
                          })
                        }
                        className="block w-full px-3 py-2.5 text-left hover:bg-sunken"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
