import NextAuth from "next-auth";
import type { NextProxy } from "next/server";
import { authConfig } from "@/auth.config";

/**
 * Formerly `middleware.ts` — Next.js 16 renamed the convention to `proxy`.
 *
 * This runs an OPTIMISTIC authorization pass: it only reads the signed
 * session cookie, never the database, because it executes on every matched
 * request including prefetches. Authoritative checks live in src/lib/dal.ts.
 *
 * The routing decision itself is in `authConfig.callbacks.authorized`.
 */
const { auth } = NextAuth(authConfig);

/**
 * `auth` is deliberately invoked with (request, event) rather than wrapped as * `auth(fn)`. NextAuth skips its own redirect-to-sign-in branch whenever a
 * wrapper callback is supplied, so wrapping would silently disable the bounce
 * to /login for unauthenticated requests.
 */
export const proxy: NextProxy = (request, event) =>
  (auth as unknown as NextProxy)(request, event);

export const config = {
  /**
   * Run on everything except Next internals, static assets, and the NextAuth
   * endpoints themselves. Application API routes are excluded here and guard
   * themselves through the data access layer instead.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$).*)",
  ],
};
