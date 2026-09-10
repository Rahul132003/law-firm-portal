import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";

import { canManageUsers } from "@/lib/auth/roles";
import { requireCapability } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { getFirmSummary } from "@/lib/reports/queries";
import { serverNow } from "@/lib/time";

export const metadata: Metadata = {
  title: `Firm Settings · ${FIRM_NAME}`,
};

export default async function SettingsFirmPage() {
  const user = await requireCapability(canManageUsers);
  const summary = await getFirmSummary({ user, now: serverNow() });

  const totals = [
    {
      label: "Total Matters",
      value: summary.totalCases,
      tone: "text-accent-700",
    },
    {
      label: "Open Matters",
      value: summary.openCases,
      tone: "text-status-judgment",
    },
    { label: "Active Staff", value: summary.activeStaff, tone: "text-success" },
    {
      label: "Documents Filed",
      value: summary.documentCount,
      tone: "text-accent-700",
    },
    {
      label: "Hearings This Week",
      value: summary.hearingsThisWeek,
      tone: "text-success",
    },
    {
      label: "Overdue Tasks",
      value: summary.overdueTasks,
      tone: "text-warning",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="surface-card p-6 md:p-8">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-hairline pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-accent-50 p-2 text-accent-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-base font-bold text-primary">
                {FIRM_NAME}
              </h2>
              <p className="text-xs text-muted">
                Firm-wide totals across every matter, advocate and filing.
              </p>
            </div>
          </div>

          <Link
            href="/reports"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-accent-700 hover:text-accent-900"
          >
            <span>Firm reports</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {totals.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-hairline/80 bg-raised p-4 text-center shadow-xs"
            >
              <dt className="text-xs font-bold uppercase tracking-wider text-muted">
                {item.label}
              </dt>
              <dd
                className={`mt-1 font-serif text-2xl font-black ${item.tone}`}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="surface-card p-6 md:p-8">
        <h2 className="font-serif text-base font-bold text-primary">
          Firm branding
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-secondary">
          The firm name shown throughout the portal, on exported reports and on
          the sign-in page comes from the{" "}
          <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[11px] text-primary">
            NEXT_PUBLIC_FIRM_NAME
          </code>{" "}
          environment variable. It is read at build time, so changing it needs a
          redeploy rather than an edit here — that keeps one source of truth
          instead of a database value and an env var disagreeing.
        </p>
      </section>
    </div>
  );
}
