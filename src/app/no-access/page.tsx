import type { Metadata } from "next";
import Link from "next/link";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `No access · ${FIRM_NAME}`,
};

/**
 * Landing spot for the proxy's optimistic role check. The proxy cannot render
 * `forbidden()` (that is a render-time interrupt), so role-denied navigations
 * are redirected here instead.
 */
export default function NoAccessPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      {" "}
      <div className="max-w-md text-center">
        {" "}
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass-600">
          Restricted area
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-primary">
          That area is not available to your role
        </h1>
        <p className="mt-3 text-sm text-secondary">
          Administration and firm-wide reporting are limited to partners and
          senior advocates.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
