import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Brute-force protection for credentials sign-in.
 *
 * Two independent counters are kept per attempt:
 *
 * - **per email** — stops password guessing against one account. Keyed by the
 *   submitted string, not a User id, so an address that does not exist locks
 *   exactly like one that does and the lockout cannot enumerate staff.
 * - **per IP** — stops one source spraying many addresses. The limit is much
 *   higher, because a whole office can sit behind one address.
 *
 * Lockouts escalate: each repeat lock on the same key doubles the duration,
 * capped at a day. A successful sign-in clears the email counter (but not the
 * IP one — one good password must not reset a spray from that address).
 *
 * This runs inside NextAuth's `authorize`, so it also covers direct POSTs to
 * /api/auth/callback/credentials that bypass the login form.
 */

const MINUTE = 60 * 1000;

export type ThrottleRule = {
  maxFailures: number;
  windowMs: number;
  baseLockMs: number;
  maxLockMs: number;
};

export const EMAIL_RULE: ThrottleRule = {
  maxFailures: 5,
  windowMs: 15 * MINUTE,
  baseLockMs: 15 * MINUTE,
  maxLockMs: 24 * 60 * MINUTE,
};

export const IP_RULE: ThrottleRule = {
  maxFailures: 50,
  windowMs: 15 * MINUTE,
  baseLockMs: 15 * MINUTE,
  maxLockMs: 24 * 60 * MINUTE,
};

/** A lock older than this no longer counts toward escalation. */
const ESCALATION_MEMORY_MS = 24 * 60 * MINUTE;

export function emailKey(email: string): string {
  return `email:${email.toLowerCase().trim()}`;
}

export function ipKey(ip: string): string {
  return `ip:${ip}`;
}

/**
 * Client address as reported by the platform proxy. On Vercel both headers
 * are set by the edge and cannot be forged by the client; behind a different
 * proxy, make sure it overwrites them, or the IP rule is advisory only.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}

export function lockDurationMs(lockCount: number, rule: ThrottleRule): number {
  return Math.min(rule.baseLockMs * 2 ** lockCount, rule.maxLockMs);
}

/** The latest active lock across the given keys, or null if none applies. */
export async function activeLockUntil(
  keys: string[],
  now: Date = new Date(),
): Promise<Date | null> {
  const locked = await prisma.loginThrottle.findMany({
    where: { key: { in: keys }, lockedUntil: { gt: now } },
    select: { lockedUntil: true },
  });

  return locked.reduce<Date | null>(
    (latest, row) =>
      row.lockedUntil && (!latest || row.lockedUntil > latest)
        ? row.lockedUntil
        : latest,
    null,
  );
}

/**
 * Counts one failure against a key and locks it when the rule trips. Each
 * step is a single conditional write, so concurrent attempts cannot reset a
 * window or skip a lock by racing each other.
 */
export async function recordFailure(
  key: string,
  rule: ThrottleRule,
  now: Date = new Date(),
): Promise<void> {
  const row = await prisma.loginThrottle.upsert({
    where: { key },
    create: { key, failures: 1, windowStart: now },
    update: { failures: { increment: 1 } },
  });

  let failures = row.failures;

  // The previous window has lapsed: this failure starts a new one.
  if (row.windowStart.getTime() < now.getTime() - rule.windowMs) {
    const forgetLocks =
      !row.lockedUntil ||
      row.lockedUntil.getTime() < now.getTime() - ESCALATION_MEMORY_MS;

    await prisma.loginThrottle.updateMany({
      where: { key, windowStart: row.windowStart },
      data: {
        failures: 1,
        windowStart: now,
        ...(forgetLocks ? { lockCount: 0 } : {}),
      },
    });
    failures = 1;
    if (forgetLocks) row.lockCount = 0;
  }

  if (failures < rule.maxFailures) return;

  await prisma.loginThrottle.updateMany({
    // Only lock a key that is not already locked, so a burst of failures
    // produces one escalation step rather than several.
    where: { key, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    data: {
      lockedUntil: new Date(now.getTime() + lockDurationMs(row.lockCount, rule)),
      lockCount: { increment: 1 },
      failures: 0,
      windowStart: now,
    },
  });
}

/** Records a failed attempt against both the email and (if known) the IP. */
export async function recordLoginFailure(
  email: string,
  ip: string | null,
  now: Date = new Date(),
): Promise<void> {
  await Promise.all([
    recordFailure(emailKey(email), EMAIL_RULE, now),
    ip ? recordFailure(ipKey(ip), IP_RULE, now) : Promise.resolve(),
  ]);
}

/** Clears an email's counter and any lock on it. */
export async function clearLoginThrottle(email: string): Promise<void> {
  await prisma.loginThrottle.deleteMany({ where: { key: emailKey(email) } });
}

/** Housekeeping: drop rows that have not changed for a week. */
export async function pruneLoginThrottle(
  now: Date = new Date(),
): Promise<number> {
  const { count } = await prisma.loginThrottle.deleteMany({
    where: {
      updatedAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * MINUTE) },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
  });
  return count;
}
