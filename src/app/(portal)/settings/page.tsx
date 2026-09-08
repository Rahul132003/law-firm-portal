import type { Metadata } from "next";
import Link from "next/link";
import { User, ShieldCheck, Key, Lock, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `Account Settings · ${FIRM_NAME}`,
};

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Account & Security Settings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your credentials, password, and view role capabilities for {FIRM_NAME}.
          </p>
        </div>

        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50 px-4 py-2.5 text-xs font-bold text-sky-700 border border-sky-200 shadow-xs hover:bg-sky-100 transition-all self-start sm:self-auto"
        >
          <User className="h-4 w-4" />
          <span>View Advocate Profile</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Profile Overview Card */}
      <section className="surface-card p-6 md:p-8">
        <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-sky-50 text-sky-700">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-base font-bold text-slate-900">Advocate Identity</h2>
            <p className="text-xs text-slate-500">Official registered name and system access level.</p>
          </div>
        </div>

        <dl className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50/60 p-4 border border-slate-200/60">
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Full Legal Name
            </dt>
            <dd className="mt-1 text-base font-bold text-slate-900">{user.name}</dd>
          </div>

          <div className="rounded-xl bg-slate-50/60 p-4 border border-slate-200/60">
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Chamber Email
            </dt>
            <dd className="mt-1 text-base font-bold text-slate-900">{user.email}</dd>
          </div>

          <div className="sm:col-span-2 rounded-xl bg-sky-50/50 p-5 border border-sky-100">
            <div className="flex items-center justify-between">
              <dt className="text-xs font-bold uppercase tracking-wider text-sky-800">
                Firm Role & Designation
              </dt>
              <span className="rounded-full bg-sky-700 text-white px-2.5 py-0.5 text-xs font-bold">
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <dd className="mt-2 text-sm text-slate-700 font-medium">
              {ROLE_DESCRIPTIONS[user.role]}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-xs text-slate-400 font-serif">
          Identity details and role privileges are managed by firm partners.
        </p>
      </section>

      {/* Password & Security Card */}
      <section className="surface-card p-6 md:p-8">
        <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-base font-bold text-slate-900">Password & Security</h2>
            <p className="text-xs text-slate-500">Update your account authentication password.</p>
          </div>
        </div>

        <ChangePasswordForm />

        <div className="mt-6 rounded-xl bg-amber-50/60 border border-amber-200/70 p-4 text-xs text-amber-900 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Changing your password applies immediately for future sign-ins. Active browser sessions remain valid until token expiry. If you suspect unauthorized access, contact a Firm Partner immediately.
          </p>
        </div>
      </section>
    </div>
  );
}
