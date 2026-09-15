import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  key: string;
  failures: number;
  windowStart: Date;
  lockCount: number;
  lockedUntil: Date | null;
  updatedAt: Date;
};

/**
 * A tiny in-memory stand-in for prisma.loginThrottle that understands exactly
 * the query shapes throttle.ts uses, so the counting and locking logic is
 * exercised for real rather than asserted against mock call arguments.
 */
const store = vi.hoisted(() => new Map<string, Row>());

vi.mock("@/lib/prisma", () => {
  type Where = {
    key?: string | { in: string[] };
    windowStart?: Date;
    lockedUntil?: { gt: Date };
    OR?: Array<{ lockedUntil: null | { lte?: Date; lt?: Date } }>;
    updatedAt?: { lt: Date };
  };
  const matches = (row: Row, where: Where) => {
    if (typeof where.key === "string" && row.key !== where.key) return false;
    if (typeof where.key === "object" && !where.key.in.includes(row.key)) return false;
    if (where.windowStart && row.windowStart.getTime() !== where.windowStart.getTime())
      return false;
    if (where.lockedUntil && !(row.lockedUntil && row.lockedUntil > where.lockedUntil.gt))
      return false;
    if (where.updatedAt && !(row.updatedAt < where.updatedAt.lt)) return false;
    if (where.OR) {
      const ok = where.OR.some(({ lockedUntil: cond }) =>
        cond === null
          ? row.lockedUntil === null
          : row.lockedUntil !== null &&
            (cond.lte ? row.lockedUntil <= cond.lte : row.lockedUntil < cond.lt!),
      );
      if (!ok) return false;
    }
    return true;
  };
  const apply = (row: Row, data: Record<string, unknown>) => {
    for (const [field, value] of Object.entries(data)) {
      const current = row[field as keyof Row];
      (row as Record<string, unknown>)[field] =
        value && typeof value === "object" && "increment" in value
          ? (current as number) + (value as { increment: number }).increment
          : value;
    }
    row.updatedAt = new Date();
  };

  return {
    prisma: {
      loginThrottle: {
        async upsert({ where, create, update }: { where: { key: string }; create: Pick<Row, "key" | "failures" | "windowStart">; update: Record<string, unknown> }) {
          const existing = store.get(where.key);
          if (existing) apply(existing, update);
          else
            store.set(where.key, {
              lockCount: 0,
              lockedUntil: null,
              updatedAt: new Date(),
              ...create,
            });
          return { ...store.get(where.key)! };
        },
        async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
          let count = 0;
          for (const row of store.values())
            if (matches(row, where)) {
              apply(row, data);
              count += 1;
            }
          return { count };
        },
        async findMany({ where }: { where: Where }) {
          return [...store.values()].filter((row) => matches(row, where));
        },
        async deleteMany({ where }: { where: Where }) {
          let count = 0;
          for (const row of [...store.values()])
            if (matches(row, where)) {
              store.delete(row.key);
              count += 1;
            }
          return { count };
        },
      },
    },
  };
});

const throttle = await import("./throttle");
const {
  EMAIL_RULE,
  IP_RULE,
  activeLockUntil,
  clearLoginThrottle,
  clientIp,
  emailKey,
  ipKey,
  lockDurationMs,
  recordLoginFailure,
} = throttle;

const MIN = 60 * 1000;
const T0 = new Date("2026-09-15T09:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * MIN);

async function fail(times: number, email = "partner@example.com", ip: string | null = "1.2.3.4", now = T0) {
  for (let i = 0; i < times; i += 1) await recordLoginFailure(email, ip, now);
}

beforeEach(() => store.clear());

describe("per-email lockout", () => {
  it("does not lock below the threshold", async () => {
    await fail(EMAIL_RULE.maxFailures - 1);
    expect(await activeLockUntil([emailKey("partner@example.com")], T0)).toBeNull();
  });

  it("locks for 15 minutes at the threshold, then releases", async () => {
    await fail(EMAIL_RULE.maxFailures);
    const key = emailKey("partner@example.com");

    expect(await activeLockUntil([key], at(1))).toEqual(at(15));
    expect(await activeLockUntil([key], at(15))).toBeNull();
  });

  it("normalises the email so case and spaces cannot dodge the counter", async () => {
    await fail(3, "Partner@Example.com ");
    await fail(2, "partner@example.com");
    expect(await activeLockUntil([emailKey("PARTNER@example.com")], at(1))).not.toBeNull();
  });

  it("locks unknown addresses exactly like real ones", async () => {
    await fail(EMAIL_RULE.maxFailures, "nobody@example.com");
    expect(await activeLockUntil([emailKey("nobody@example.com")], at(1))).toEqual(at(15));
  });

  it("starts a fresh window once the old one lapses", async () => {
    await fail(EMAIL_RULE.maxFailures - 1, undefined, null, T0);
    await fail(1, undefined, null, at(16));
    expect(await activeLockUntil([emailKey("partner@example.com")], at(17))).toBeNull();
  });

  it("escalates repeat lockouts and caps at a day", async () => {
    const key = emailKey("partner@example.com");
    await fail(EMAIL_RULE.maxFailures, undefined, null, T0);
    // Second round of failures straight after the first lock expires.
    await fail(EMAIL_RULE.maxFailures, undefined, null, at(15));
    expect(await activeLockUntil([key], at(16))).toEqual(at(15 + 30));

    expect(lockDurationMs(10, EMAIL_RULE)).toBe(24 * 60 * MIN);
  });

  it("a burst of failures while unlocked produces a single lock step", async () => {
    await fail(EMAIL_RULE.maxFailures * 2);
    // The second batch trips the threshold again, but the key is already
    // locked, so it must neither escalate nor extend the lock.
    expect(store.get(emailKey("partner@example.com"))!.lockCount).toBe(1);
    expect(await activeLockUntil([emailKey("partner@example.com")], at(1))).toEqual(at(15));
  });

  it("clearing removes the lock (successful sign-in or partner unlock)", async () => {
    await fail(EMAIL_RULE.maxFailures);
    await clearLoginThrottle("PARTNER@example.com");
    expect(await activeLockUntil([emailKey("partner@example.com")], at(1))).toBeNull();
  });
});

describe("per-IP lockout", () => {
  it("blocks an address spraying many accounts", async () => {
    for (let i = 0; i < IP_RULE.maxFailures; i += 1) {
      await recordLoginFailure(`user${i}@example.com`, "9.9.9.9", T0);
    }
    expect(await activeLockUntil([ipKey("9.9.9.9")], at(1))).not.toBeNull();
    expect(await activeLockUntil([emailKey("user0@example.com")], at(1))).toBeNull();
  });

  it("is not cleared by one successful sign-in from that address", async () => {
    for (let i = 0; i < IP_RULE.maxFailures; i += 1) {
      await recordLoginFailure(`user${i}@example.com`, "9.9.9.9", T0);
    }
    await clearLoginThrottle("user0@example.com");
    expect(await activeLockUntil([ipKey("9.9.9.9")], at(1))).not.toBeNull();
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop, then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers({ "x-real-ip": "2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientIp(new Headers())).toBeNull();
  });
});
