import { cookies } from "next/headers";
import Link from "next/link";

import { MobileNav } from "@/components/nav/mobile-nav";
import { PortalChrome } from "@/components/nav/portal-chrome";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireUser } from "@/lib/dal";
import { FIRM_INITIALS, FIRM_NAME } from "@/lib/firm";
import { navItemsForRole } from "@/lib/nav";
import {
  countUnreadNotifications,
  listNotifications,
} from "@/lib/notifications/queries";
import { serverNow, serverNowMs } from "@/lib/time";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/**
 * Shell for every authenticated route.
 *
 * `requireUser()` here is a convenience, not the security boundary — a layout
 * does not re-run on every child navigation, so each page and server action
 * still performs its own check through the data access layer.
 *
 * The rail (dark, always visible on desktop) carries navigation and
 * identity; the top bar above the content carries the date, notifications
 * and the account menu. Below `md` both disappear in favour of a slim mobile
 * header and a horizontally scrolling section strip.
 */
export default async function PortalLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const items = navItemsForRole(user.role);
  const now = serverNow();

  const [notifications, unreadCount, cookieStore] = await Promise.all([
    listNotifications(20),
    countUnreadNotifications(),
    cookies(),
  ]);

  // Read on the server so the rail renders at its correct width on first
  // paint, with no hydration mismatch and no flash of the wrong layout.
  const collapsed = cookieStore.get("portal_rail")?.value === "rail";

  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??";

  const chromeUser = { name: user.name, roleLabel: ROLE_LABELS[user.role], initials };

  return (
    <PortalChrome
      items={items}
      firmName={FIRM_NAME}
      user={chromeUser}
      notifications={notifications}
      unreadCount={unreadCount}
      nowMs={serverNowMs()}
      dateLabel={dateFmt.format(now)}
      initialCollapsed={collapsed}
    >
      {/* Mobile only — the rail and top bar are hidden below md. */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-hairline bg-raised px-4 py-2.5 md:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-700 font-serif text-xs font-semibold text-white">
            {FIRM_INITIALS}
          </span>
          <span className="truncate font-serif text-sm font-semibold text-primary">
            {FIRM_NAME}
          </span>
        </Link>
        <span className="shrink-0 text-[11px] text-muted">
          {ROLE_LABELS[user.role]}
        </span>
      </header>

      <MobileNav items={items} unreadCount={unreadCount} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </PortalChrome>
  );
}
