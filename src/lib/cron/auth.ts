import "server-only";
import { safeCompare } from "@/lib/crypto";

/**
 * Shared guard for scheduled endpoints.
 *
 * These have no session — they are called by a scheduler, not a person — so
 * they authenticate on a shared secret compared in constant time. Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET`; `x-cron-secret` is accepted for
 * other schedulers.
 *
 * Returns false when CRON_SECRET is unset, so a misconfigured deployment
 * refuses to run these rather than exposing them unguarded.
 */
export function isCronAuthorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return safeCompare(bearer.slice("Bearer ".length), expected);
  }

  const header = request.headers.get("x-cron-secret");
  return header ? safeCompare(header, expected) : false;
}
