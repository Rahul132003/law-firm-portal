import Link from "next/link";

/**
 * Rendered whenever the data access layer calls `forbidden()` — a signed-in
 * user reaching something their role does not cover. Distinct from the login
 * bounce, which is for unauthenticated visitors.
 */
export default function Forbidden() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      {" "}
      <div className="max-w-md text-center">
        {" "}
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">
          403 — Forbidden
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-primary">
          You do not have access to this
        </h1>
        <p className="mt-3 text-sm text-secondary">
          Your role does not cover this area of the portal, or you are not
          assigned to this case. If you believe you should have access, ask a
          partner to update your assignment.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-secondary"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
