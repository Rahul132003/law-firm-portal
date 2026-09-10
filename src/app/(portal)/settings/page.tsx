import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, User, UserPlus } from "lucide-react";

import {
  canManageUsers,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/lib/auth/roles";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `Account Settings · ${FIRM_NAME}`,
};

export default async function SettingsAccountPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <section className="surface-card p-6 md:p-8">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-hairline pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-accent-50 p-2 text-accent-700">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-base font-bold text-primary">
                Advocate Identity
              </h2>
              <p className="text-xs text-muted">
                Official registered name and system access level.
              </p>
            </div>
          </div>

          <Link
            href="/profile"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-xs font-bold text-accent-700 shadow-xs transition-all hover:bg-accent-50"
          >
            <span className="hidden sm:inline">View Advocate Profile</span>
            <span className="sm:hidden">Profile</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <dl className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-hairline/60 bg-sunken/60 p-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">
              Full Legal Name
            </dt>
            <dd className="mt-1 text-base font-bold text-primary">
              {user.name}
            </dd>
          </div>

          <div className="rounded-xl border border-hairline/60 bg-sunken/60 p-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">
              Chamber Email
            </dt>
            <dd className="mt-1 text-base font-bold text-primary">
              {user.email}
            </dd>
          </div>

          <div className="rounded-xl border border-accent-100 bg-accent-50/50 p-5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <dt className="text-xs font-bold uppercase tracking-wider text-accent-800">
                Firm Role & Designation
              </dt>
              <span className="rounded-full bg-accent-800 px-2.5 py-0.5 text-xs font-bold text-white">
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <dd className="mt-2 text-sm font-medium text-secondary">
              {ROLE_DESCRIPTIONS[user.role]}
            </dd>
          </div>
        </dl>

        <p className="mt-5 font-serif text-xs text-muted">
          Identity details and role privileges are managed by firm partners.
        </p>
      </section>

      {/* The one administration action worth a shortcut from here: issuing an
          account is what a partner most often arrives at settings to do. */}
      {canManageUsers(user.role) ? (
        <section className="surface-card flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-accent-50 p-2 text-accent-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-base font-bold text-primary">
                Onboarding a new advocate or clerk?
              </h2>
              <p className="text-xs text-muted">
                There is no self-service sign-up — partners issue every account
                under Team &amp; access.
              </p>
            </div>
          </div>

          <Link
            href="/settings/team?new=1"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-accent-800"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add a user</span>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
