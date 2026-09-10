"use client";

import { useEffect } from "react";

/**
 * Root error boundary.
 *
 * Without this, an unhandled server error renders Next's bare default screen
 * ("This page couldn't load"), which gives whoever is on shift no idea
 * whether the portal is broken, their session expired, or the database is
 * simply unreachable.
 *
 * The most common cause in this project by far is a dropped database
 * connection — the local Postgres server holding its ports while no longer
 * answering — so that case gets named explicitly.
 */

/** Signatures of a connectivity failure rather than an application bug. */
const CONNECTION_HINTS = [
  "connection terminated",
  "connection refused",
  "econnrefused",
  "etimedout",
  "can't reach database",
  "connection pool",
  "server has closed the connection",
];

function isConnectionError(message: string): boolean {
  const haystack = message.toLowerCase();
  return CONNECTION_HINTS.some((hint) => haystack.includes(hint));
}

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // Next 16 passes `retry`, which re-fetches the segment. (`reset` also
  // exists but only re-renders, so it would show the same failure again.)
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Portal error boundary caught:", error);
  }, [error]);

  const connectivity = isConnectionError(error.message ?? "");

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="w-full max-w-lg">
        <div className="card p-8">
          <p className="eyebrow text-danger">
            {connectivity ? "Database unreachable" : "Something went wrong"}
          </p>

          <h1 className="mt-3 text-2xl">
            {connectivity
              ? "The portal cannot reach its database"
              : "This page did not load"}
          </h1>

          <p className="mt-3 text-sm text-secondary">
            {connectivity
              ? "Your work is safe — nothing was lost. The application is running, but the database is not answering, so no case data could be read."
              : "An unexpected error interrupted this page. Retrying will re-fetch it."}
          </p>

          {connectivity ? (
            <div className="mt-5 rounded-md border border-hairline bg-sunken p-4">
              <p className="eyebrow">If you are running this locally</p>
              <p className="mt-2 text-sm text-secondary">
                The local Postgres server has most likely stopped responding.
                Restart it, then retry:
              </p>
              <pre className="scroll-x mt-2 rounded border border-hairline bg-raised px-3 py-2 font-mono text-xs text-primary">
                npx prisma dev
              </pre>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-800"
            >
              Try again
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-hairline-strong bg-raised px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-sunken"
            >
              Back to dashboard
            </a>
          </div>

          {/* The digest is what ties this screen to a server log line. */}
          {error.digest ? (
            <p className="mt-5 border-t border-hairline pt-4 font-mono text-xs text-muted">
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
