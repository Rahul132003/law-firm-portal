import type { Metadata } from "next";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listClients } from "@/lib/clients/queries";
import { CLIENT_KIND_LABELS } from "@/lib/clients/validation";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `Clients · ${FIRM_NAME}`,
};

export default async function ClientsPage(props: PageProps<"/clients">) {
  const user = await requireUser();
  const { q: rawQ } = await props.searchParams;
  const q = typeof rawQ === "string" && rawQ.trim() ? rawQ.trim().slice(0, 100) : undefined;

  const clients = await listClients(user, q);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Clients</h1>
        <p className="mt-1 text-sm text-secondary">
          {user.role === "ADMIN_PARTNER"
            ? "Every client of the firm."
            : "Clients on matters you can access."}{" "}
          New clients are added when a case is opened for them.
        </p>
      </header>

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="client-search" className="sr-only">
          Search clients
        </label>
        <input
          id="client-search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name, email or phone"
          className="field-input max-w-sm"
        />
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
        {q ? (
          <Link href="/clients" className={buttonClass("secondary")}>
            Clear
          </Link>
        ) : null}
      </form>

      {clients.length === 0 ? (
        q ? (
          <EmptyState title="No clients match that search" description="Try a shorter part of the name." />
        ) : (
          <EmptyState
            title="No clients yet"
            description="Clients appear here once a matter is opened for them. Existing matters can be linked with npm run clients:backfill."
          />
        )
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline bg-sunken/80 text-left">
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-secondary">
                  Client
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-secondary">
                  Contact
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-secondary">
                  Open matters
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-secondary">
                  All matters
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-hairline last:border-0 hover:bg-sunken/70">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${client.id}`} className="font-medium text-primary hover:underline">
                      {client.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-muted">{CLIENT_KIND_LABELS[client.kind]}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary">
                    {client.email || client.phone ? (
                      <>
                        {client.email ? <div>{client.email}</div> : null}
                        {client.phone ? <div>{client.phone}</div> : null}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-primary">{client.cases.length}</td>
                  <td className="px-4 py-3 text-right text-secondary">{client._count.cases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
