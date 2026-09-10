"use client";

import { LogOut, User as UserIcon, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { signOutAction } from "@/lib/auth/actions";

/** Avatar + dropdown, for the light top bar. Distinct chrome from the rail's
 * own identity block, which lives on the dark surface and stays visible. */
export function AccountMenu({
  user,
}: {
  user: { name: string; roleLabel: string; initials: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 transition-colors hover:bg-sunken"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-700 text-xs font-bold text-white">
          {user.initials}
        </span>
      </button>

      {open ? (
        <>
          {/* Click-outside catcher. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-lg border border-hairline bg-raised py-1 shadow-lg">
            <div className="border-b border-hairline px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-primary">
                {user.name}
              </p>
              <p className="truncate text-xs text-muted">{user.roleLabel}</p>
            </div>

            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-secondary transition-colors hover:bg-sunken hover:text-primary"
            >
              <UserIcon className="size-4" strokeWidth={1.75} aria-hidden="true" />
              My Profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-secondary transition-colors hover:bg-sunken hover:text-primary"
            >
              <SettingsIcon
                className="size-4"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              Settings
            </Link>

            <div className="border-t border-hairline pt-1">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger transition-colors hover:bg-danger-soft"
                >
                  <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
