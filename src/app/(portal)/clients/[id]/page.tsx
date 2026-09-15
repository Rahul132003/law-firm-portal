import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge, TypeBadge } from "@/components/cases/status-badge";
import { ClientEditor } from "@/components/clients/client-editor";
import { EmptyState } from "@/components/ui/empty-state";
import { canCreateCases } from "@/lib/auth/roles";
import { getClientDetail } from "@/lib/clients/queries";
import { CLIENT_KIND_LABELS } from "@/lib/clients/validation";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `Client · ${FIRM_NAME}`,
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

export default async function ClientDetailPage(props: PageProps<"/clients/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();

  // Out-of-scope clients 404 rather than 403, so their existence is not revealed.
  const client = await getClientDetail(user, id);
  if (!client) notFound();

  const openMatters = client.cases.filter((matter) => matter.status !== "CLOSED").length;

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="mb-4 text-sm">
        <Link href="/clients" className="text-secondary underline-offset-2 hover:underline">
          ← Clients
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{client.name}</h1>
        <p className="mt-1 text-sm text-secondary">
          {CLIENT_KIND_LABELS[client.kind]} · client since {formatDate(client.createdAt)} · {openMatters} open of{" "}
          {client.cases.length} matter{client.cases.length === 1 ? "" : "s"}
        </p>
      </header>

      <section className="card mb-6 p-6">
        <h2 className="mb-4 text-sm font-semibold text-primary">Contact details</h2>
        <dl className="grid gap-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-1 break-words text-sm text-primary">
              {client.email ? <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a> : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Phone</dt>
            <dd className="mt-1 text-sm text-primary">
              {client.phone ? <a href={`tel:${client.phone}`} className="hover:underline">{client.phone}</a> : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Address</dt>
            <dd className="mt-1 whitespace-pre-line text-sm text-primary">{client.address || "—"}</dd>
          </div>
        </dl>
        {canCreateCases(user.role) ? (
          <div className="mt-5 border-t border-hairline pt-4">
            <ClientEditor client={client} matterCount={client.cases.length} />
          </div>
        ) : null}
      </section>

      <h2 className="mb-3 text-sm font-semibold text-primary">Matters</h2>
      {client.cases.length === 0 ? (
        <EmptyState title="No matters yet" description="Matters opened for this client will be listed here." />
      ) : (
        <ul className="space-y-2">
          {client.cases.map((matter) => (
            <li key={matter.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link href={`/cases/${matter.id}`} className="font-medium text-primary hover:underline">
                  {matter.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-mono">{matter.caseNumber}</span>
                  <TypeBadge caseType={matter.caseType} />
                  <span>{matter.court}</span>
                  {matter.opposingParty ? <span>v. {matter.opposingParty}</span> : null}
                </div>
              </div>
              <StatusBadge status={matter.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
