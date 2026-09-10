import type { Metadata } from "next";
import Link from "next/link";
import { 
  Scale, 
  Mail, 
  Briefcase, 
  KeyRound, 
  ChevronRight,
  UserCheck
} from "lucide-react";

import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: `My Profile · ${FIRM_NAME}`,
};

export default async function ProfilePage() {
  const sessionUser = await requireUser();

  // Fetch complete profile with assignments, supervisor, reports and stats
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      supervisor: {
        select: { id: true, name: true, email: true, role: true },
      },
      reports: {
        select: { id: true, name: true, email: true, role: true },
      },
      assignments: {
        include: {
          case: {
            select: { id: true, caseNumber: true, title: true, status: true, caseType: true },
          },
        },
        take: 5,
      },
      _count: {
        select: {
          assignments: true,
          assignedTasks: true,
          uploadedDocuments: true,
          authoredNotes: true,
        },
      },
    },
  });

  if (!user) {
    return (
      <div className="surface-card p-8 text-center text-muted">
        Could not load advocate profile.
      </div>
    );
  }

  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const joinedFormatted = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(user.createdAt);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-primary md:text-3xl">
            Advocate Profile
          </h1>
          <p className="mt-1 text-sm text-muted">
            Official advocate service record and firm matter portfolio ({FIRM_NAME}).
          </p>
        </div>

        <Link
          href="/settings"
          className="inline-flex items-center gap-2 rounded-xl bg-accent-50 px-4 py-2.5 text-xs font-bold text-accent-700 border border-accent-200 shadow-xs hover:bg-accent-50 transition-all self-start sm:self-auto"
        >
          <KeyRound className="h-4 w-4" />
          <span>Security & Password</span>
        </Link>
      </div>

      {/* Main Identity Banner Card */}
      <div className="surface-card overflow-hidden">
        {/* Gradient Header Banner */}
        <div className="relative bg-accent-800 p-6 text-white md:p-8">
          <div className="absolute right-6 top-6 opacity-10 pointer-events-none">
            <Scale className="w-32 h-32 text-white" />
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
            {/* Avatar Circle */}
            <div className="h-24 w-24 shrink-0 rounded-2xl bg-white/20 backdrop-blur-md border-2 border-white/40 shadow-xl flex items-center justify-center text-3xl font-black text-white tracking-wider">
              {initials}
            </div>

            <div className="text-center sm:text-left min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  {user.name}
                </h2>
                <span className="rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-xs font-bold text-white border border-white/30">
                  {ROLE_LABELS[user.role]}
                </span>
                <span className="rounded-full bg-success/80 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  Active
                </span>
              </div>

              <p className="mt-1 text-sm text-accent-100 font-medium">
                {FIRM_NAME} • Legal Practice Department
              </p>

              <p className="mt-2 text-xs text-accent-200/90 line-clamp-2 max-w-xl">
                {ROLE_DESCRIPTIONS[user.role]}
              </p>
            </div>
          </div>
        </div>

        {/* Practice & Contact Details Grid */}
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-hairline">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted font-serif mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent-700" />
              Contact & Chamber Details
            </h3>
            <div className="space-y-3.5">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Email Address</dt>
                <dd className="mt-0.5 text-sm font-semibold text-primary">{user.email}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Firm Association</dt>
                <dd className="mt-0.5 text-sm font-semibold text-primary">{FIRM_NAME}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Portal Onboarding Date</dt>
                <dd className="mt-0.5 text-sm font-semibold text-primary">{joinedFormatted}</dd>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted font-serif mb-4 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-accent-700" />
              Reporting & Hierarchy
            </h3>
            <div className="space-y-3.5">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Supervising Advocate</dt>
                <dd className="mt-0.5 text-sm font-semibold text-primary">
                  {user.supervisor ? (
                    <span className="flex items-center gap-1.5 text-primary">
                      <UserCheck className="h-4 w-4 text-success" />
                      {user.supervisor.name} ({ROLE_LABELS[user.supervisor.role]})
                    </span>
                  ) : (
                    <span className="text-muted italic">None (Partner / Independent)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Direct Team Mates</dt>
                <dd className="mt-0.5 text-sm font-semibold text-primary">
                  {user.reports.length > 0 ? (
                    <span>{user.reports.length} Team Members supervised</span>
                  ) : (
                    <span className="text-muted italic">No assigned junior reports</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Role Privilege Level</dt>
                <dd className="mt-0.5 text-sm font-semibold text-accent-700">
                  {user.role === "ADMIN_PARTNER" ? "Firm-Wide Administrator" : "Case Team Member"}
                </dd>
              </div>
            </div>
          </div>
        </div>

        {/* Practice Overview Metrics */}
        <div className="bg-sunken/60 p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="rounded-xl bg-white p-4 border border-hairline/80 shadow-xs">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">Active Cases</dt>
            <dd className="mt-1 font-serif text-2xl font-black text-accent-700">{user._count.assignments}</dd>
          </div>
          <div className="rounded-xl bg-white p-4 border border-hairline/80 shadow-xs">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">Assigned Tasks</dt>
            <dd className="mt-1 font-serif text-2xl font-black text-status-judgment">{user._count.assignedTasks}</dd>
          </div>
          <div className="rounded-xl bg-white p-4 border border-hairline/80 shadow-xs">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">Pleadings Filed</dt>
            <dd className="mt-1 font-serif text-2xl font-black text-success">{user._count.uploadedDocuments}</dd>
          </div>
          <div className="rounded-xl bg-white p-4 border border-hairline/80 shadow-xs">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">Strategy Notes</dt>
            <dd className="mt-1 font-serif text-2xl font-black text-warning">{user._count.authoredNotes}</dd>
          </div>
        </div>
      </div>

      {/* Practice Matters / Recent Assigned Cases */}
      <div className="surface-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-hairline">
          <div>
            <h3 className="font-serif text-base font-bold text-primary">
              Assigned Legal Matters
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Recent matters where you are listed as counsel or case team.
            </p>
          </div>
          <Link
            href="/cases"
            className="text-xs font-bold text-accent-700 hover:text-accent-900 flex items-center gap-1"
          >
            <span>View All Matters</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {user.assignments.length === 0 ? (
          <p className="text-sm text-muted italic py-4 text-center">
            No specific case assignments currently assigned.
          </p>
        ) : (
          <div className="space-y-3">
            {user.assignments.map(({ case: c, roleOnCase }) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-hairline/80 bg-sunken/50 p-4 transition-all hover:border-accent-200 hover:bg-accent-50/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-accent-700">{c.caseNumber}</span>
                    <span className="rounded bg-sunken/80 px-2 py-0.5 text-[10px] font-bold text-secondary uppercase">
                      {c.caseType}
                    </span>
                    <span className="rounded bg-accent-50 px-2 py-0.5 text-[10px] font-bold text-accent-800 uppercase">
                      {roleOnCase.replace(/_/g, " ")}
                    </span>
                  </div>
                  <h4 className="mt-1 truncate font-semibold text-sm text-primary">{c.title}</h4>
                </div>

                <Link
                  href={`/cases/${c.id}`}
                  className="ml-4 shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-secondary border border-hairline shadow-xs hover:bg-sunken"
                >
                  Open Matter
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted pb-4 font-serif">
        Advocate profile information is managed by {FIRM_NAME} Administration.
      </p>
    </div>
  );
}
