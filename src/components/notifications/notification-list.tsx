"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { NotificationKind } from "@/generated/prisma/enums";
import {
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/actions";
import { NOTIFICATION_KINDS } from "@/lib/notifications/kinds";

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
};

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function NotificationList({ rows }: { rows: NotificationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ul className="card divide-y divide-hairline">
      {rows.map((item) => (
        <li key={item.id} className={`flex items-start gap-3 px-4 py-3 ${item.readAt ? "" : "bg-accent-50/40"}`}>
          <span
            aria-hidden="true"
            className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "" : "bg-accent-600"}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              {item.linkUrl ? (
                <Link
                  href={item.linkUrl}
                  onClick={() => {
                    if (!item.readAt) startTransition(() => markNotificationRead(item.id));
                  }}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {item.title}
                </Link>
              ) : (
                <span className="text-sm font-medium text-primary">{item.title}</span>
              )}
              <span className="text-[11px] text-muted">{NOTIFICATION_KINDS[item.kind].label}</span>
            </div>
            <p className="mt-0.5 text-sm text-secondary">{item.body}</p>
            {/* Server and browser time zones can differ. */}
            <p suppressHydrationWarning className="mt-1 text-[11px] text-muted">
              {timeFormat.format(item.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!item.readAt ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await markNotificationRead(item.id);
                    router.refresh();
                  })
                }
                className="rounded-md border border-hairline px-2 py-1 text-[11px] text-secondary hover:bg-sunken"
              >
                Mark read
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              aria-label={`Dismiss "${item.title}"`}
              onClick={() =>
                startTransition(async () => {
                  await dismissNotification(item.id);
                  router.refresh();
                })
              }
              className="rounded-md border border-hairline px-2 py-1 text-[11px] text-secondary hover:bg-sunken"
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsRead();
          router.refresh();
        })
      }
      className="rounded-md border border-hairline px-3 py-1.5 text-xs text-secondary hover:bg-sunken disabled:opacity-50"
    >
      Mark all read
    </button>
  );
}
