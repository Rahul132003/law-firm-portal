import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ROLE_LABELS, canPostNotices } from "@/lib/auth/roles";
import { requireCapability } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { getNoticeReceipts } from "@/lib/notices/queries";

export const metadata: Metadata = {
  title: `Read receipts · ${FIRM_NAME}`,
};

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function NoticeReceiptsPage(
  props: PageProps<"/notices/[id]/receipts">,
) {
  const { id } = await props.params;

  // Same capability as posting: this is a compliance view.
  await requireCapability(canPostNotices);

  const receipts = await getNoticeReceipts(id);
  if (!receipts) notFound();

  const total = receipts.read.length + receipts.outstanding.length;
  const pct = total === 0 ? 0 : Math.round((receipts.read.length / total) * 100);

  return (
    <div className="mx-auto max-w-2xl">
      <nav className="mb-4 text-sm">
        <Link
          href="/notices"
          className="text-secondary underline-offset-2 hover:underline"
        >
          ← Notice board
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          {receipts.title}
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Posted {formatDateTime(receipts.createdAt)} ·{" "}
          {receipts.read.length} of {total} acknowledged ({pct}%)
        </p>
      </header>

      {/* Progress is shown as a labelled bar, never colour alone. */}
      <div
        role="img"
        aria-label={`${receipts.read.length} of ${total} people have acknowledged this notice`}
        className="mb-6 h-2 w-full overflow-hidden rounded-full bg-sunken"
      >
        <div
          className="h-full rounded-full bg-brass-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-primary">
            Acknowledged ({receipts.read.length})
          </h2>
          {receipts.read.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nobody yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {receipts.read.map((entry) => (
                <li key={entry.user.id}>
                  <span className="block text-sm text-primary">
                    {entry.user.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {ROLE_LABELS[entry.user.role]} ·{" "}
                    {formatDateTime(entry.readAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-primary">
            Outstanding ({receipts.outstanding.length})
          </h2>
          <p className="mt-0.5 text-xs text-muted">Active staff only.</p>
          {receipts.outstanding.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-700">
              Everyone has acknowledged this notice.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {receipts.outstanding.map((person) => (
                <li key={person.id}>
                  <span className="block text-sm text-primary">
                    {person.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {ROLE_LABELS[person.role]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
