import Link from "next/link";

import { NotificationBell } from "@/components/nav/notification-bell";
import { SidebarNav } from "@/components/nav/sidebar-nav";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireUser } from "@/lib/dal";
import { FIRM_INITIALS, FIRM_NAME } from "@/lib/firm";
import { navItemsForRole } from "@/lib/nav";
import { serverNowMs } from "@/lib/time";
import {
  countUnreadNotifications,
  listNotifications,
} from "@/lib/notifications/queries";

/**
 * Shell for every authenticated route.
 *
 * `requireUser()` here is a convenience, not the security boundary — a layout
 * does not re-run on every child navigation, so each page and server action
 * still performs its own check through the data access layer.
 */
export default async function PortalLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const items = navItemsForRole(user.role);

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(20),
    countUnreadNotifications(),
  ]);

  const firstName = user.name.split(" ")[0];
  const userInitials = user.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const dayFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const now = new Date();

  return (
    <div className="flex min-h-dvh bg-slate-50/70 text-slate-900 selection:bg-amber-500/20 selection:text-amber-900">
      {/* Clean White Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white md:flex shadow-xs z-30">
        <div className="flex items-center gap-3.5 border-b border-slate-100 px-6 py-5">
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-tr from-sky-500 via-sky-600 to-rose-500 text-lg font-black text-white shadow-md shadow-sky-500/20">
            {FIRM_INITIALS}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-extrabold tracking-tight text-slate-900">
              {FIRM_NAME}
            </span>
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mt-0.5">
              MANAGEMENT PORTAL
            </span>
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <SidebarNav items={items} />
        </div>
        
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between rounded-2xl bg-slate-100/80 p-3 border border-slate-200/60 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid size-10 place-items-center rounded-full bg-emerald-500 text-sm font-black text-white shadow-xs">
                {userInitials}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href="/settings"
                  className="block truncate text-sm font-extrabold text-slate-900 hover:text-sky-700 transition-colors"
                >
                  {user.name}
                </Link>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="truncate text-[11px] font-bold text-slate-500">
                    {ROLE_LABELS[user.role]}
                  </span>
                  <span className="rounded-md bg-amber-100 border border-amber-300 px-1.5 py-0.2 text-[9px] font-black uppercase text-amber-900">
                    ADMIN
                  </span>
                </div>
              </div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header Navbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 py-3.5 md:px-8">
          <div>
            <h2 className="text-base md:text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
              👋 Good afternoon, <span className="text-sky-700">{firstName}</span>
            </h2>
            <p className="text-xs font-semibold text-slate-500">
              {dayFmt.format(now)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="hidden sm:flex items-center gap-2 rounded-full bg-sky-50 border border-sky-200 px-4 py-2 text-xs font-bold text-sky-700 shadow-xs hover:bg-sky-100 transition-all"
            >
              <span>🔔</span> Get Mobile Alerts
            </button>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                nowMs={serverNowMs()}
              />

              <Link
                href="/settings"
                title="Account Settings"
                className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                🔑
              </Link>

              <SignOutButton showLabel={false} className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all" />

              <div className="hidden md:flex items-center gap-2.5 ml-2 pl-2 border-l border-slate-200">
                <div className="text-right">
                  <span className="block text-xs font-black text-slate-900 leading-tight">
                    {user.name}
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-500">
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>
                <Link
                  href="/profile"
                  title="View Profile"
                  className="grid size-9 place-items-center rounded-full bg-emerald-500 text-xs font-black text-white shadow-xs hover:ring-2 hover:ring-emerald-400 transition-all"
                >
                  {userInitials}
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-[1500px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
