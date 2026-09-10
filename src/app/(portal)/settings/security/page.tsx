import type { Metadata } from "next";
import { Lock, ShieldAlert } from "lucide-react";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `Security · ${FIRM_NAME}`,
};

export default async function SettingsSecurityPage() {
  await requireUser();

  return (
    <section className="surface-card p-6 md:p-8">
      <div className="mb-5 flex items-center gap-3 border-b border-hairline pb-4">
        <div className="rounded-xl bg-sunken p-2 text-status-judgment">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-base font-bold text-primary">
            Password & Security
          </h2>
          <p className="text-xs text-muted">
            Update your account authentication password.
          </p>
        </div>
      </div>

      <ChangePasswordForm />

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft/60 p-4 text-xs text-warning">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <p className="leading-relaxed">
          Changing your password applies immediately for future sign-ins. Active
          browser sessions remain valid until token expiry. If you suspect
          unauthorized access, contact a Firm Partner immediately.
        </p>
      </div>
    </section>
  );
}
