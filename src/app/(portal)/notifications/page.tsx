import type { Metadata } from "next";
import Link from "next/link";

import {
  MarkAllReadButton,
  NotificationList,
} from "@/components/notifications/notification-list";
import { EmptyState } from "@/components/ui/empty-state";
import type { NotificationKind } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { NOTIFICATION_KINDS, NOTIFICATION_KIND_ORDER } from "@/lib/notifications/kinds";
import {
  countUnreadNotifications,
  listNotificationPage,
} from "@/lib/notifications/queries";

export const metadata: Metadata = {
  title: `Notifications · ${FIRM_NAME}`,
};

function pick(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() || undefined;
}

export default async function NotificationsPage(props: PageProps<"/notifications">) {
  const user = await requireUser();
  const params = await props.searchParams;

  const unreadOnly = pick(params.show) === "unread";
  const kindParam = pick(params.kind);
  const kind = NOTIFICATION_KIND_ORDER.includes(kindParam as NotificationKind)
    ? (kindParam as NotificationKind)
    : undefined;
  const before = pick(params.before);

  const [{ rows, nextCursor }, unreadCount] = await Promise.all([
    listNotificationPage({ unreadOnly, kind, before }),
    countUnreadNotifications(),
  ]);

  const href = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { show: unreadOnly ? "unread" : undefined, kind, ...overrides };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    const query = next.toString();
    return query ? `/notifications?${query}` : "/notifications";
  };

  const kindsForRole = NOTIFICATION_KIND_ORDER.filter(
    (k) => NOTIFICATION_KINDS[k].audience?.(user.role) ?? true,
  );

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${
      active
        ? "border-accent-700 bg-accent-700 text-white"
        : "border-hairline text-secondary hover:bg-sunken"
    }`;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Notifications</h1>
          <p className="mt-1 text-sm text-secondary">
            {unreadCount === 0 ? "You are all caught up." : `${unreadCount} unread.`} Read
            notifications are cleared after 90 days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 ? <MarkAllReadButton /> : null}
          <Link
            href="/settings/notifications"
            className="rounded-md border border-hairline px-3 py-1.5 text-xs text-secondary hover:bg-sunken"
          >
            Preferences
          </Link>
        </div>
      </header>

      <nav aria-label="Filter notifications" className="mb-4 flex flex-wrap gap-2">
        <Link href={href({ show: undefined, before: undefined })} className={chip(!unreadOnly)}>
          All
        </Link>
        <Link href={href({ show: "unread", before: undefined })} className={chip(unreadOnly)}>
          Unread
        </Link>
        <span aria-hidden="true" className="mx-1 self-center text-hairline">|</span>
        <Link href={href({ kind: undefined, before: undefined })} className={chip(!kind)}>
          Every kind
        </Link>
        {kindsForRole.map((k) => (
          <Link key={k} href={href({ kind: k, before: undefined })} className={chip(kind === k)}>
            {NOTIFICATION_KINDS[k].label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title={unreadOnly || kind ? "Nothing matches these filters" : "No notifications yet"}
          description="Reminders, deadline alerts and updates on your cases will appear here."
        />
      ) : (
        <>
          <NotificationList rows={rows} />
          <div className="mt-4 flex justify-between text-sm">
            {before ? (
              <Link href={href({ before: undefined })} className="text-secondary hover:underline">
                ← Newest
              </Link>
            ) : (
              <span />
            )}
            {nextCursor ? (
              <Link href={href({ before: nextCursor })} className="text-secondary hover:underline">
                Older →
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
