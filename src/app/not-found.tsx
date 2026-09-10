import Link from "next/link";

/**
 * 404. Reached by `notFound()` and by unmatched routes — including a case or
 * document id that does not resolve for this user.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="w-full max-w-md text-center">
        <p className="eyebrow">404 — Not found</p>
        <h1 className="mt-3 text-2xl">This page does not exist</h1>
        <p className="mt-3 text-sm text-secondary">
          The link may be out of date, or the record it pointed to has been
          removed.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-800"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
