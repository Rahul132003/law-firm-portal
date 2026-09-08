import "server-only";
import type { ReminderOffset } from "@/generated/prisma/enums";
import { deliver } from "@/lib/notifications/deliver";
import { prisma } from "@/lib/prisma";

/**
 * Hearing reminder sweep.
 *
 * Design notes:
 *
 * - **Bucketed, not exact-day.** A reminder fires for the most urgent bucket
 *   a hearing has entered (≤7, ≤3, ≤1 days), rather than requiring the
 *   hearing to be exactly N days out. A sweep that fails to run for a day
 *   therefore catches up instead of silently skipping a reminder — the
 *   failure mode that matters for a court date.
 *
 * - **Less urgent buckets are marked sent, not fired.** A hearing booked
 *   two days out enters the ≤3 bucket; its ≤7 reminder is recorded as
 *   already handled so it cannot fire later, out of order.
 *
 * - **Idempotent.** `HearingReminder` has a unique (hearingId, offset), and
 *   dispatch rows are written in the same transaction as the send decision,
 *   so re-running the sweep sends nothing twice.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Most urgent first — the order the bucket search relies on. */
const BUCKETS: ReadonlyArray<{ offset: ReminderOffset; days: number }> = [
  { offset: "DAY_1", days: 1 },
  { offset: "DAY_3", days: 3 },
  { offset: "DAY_7", days: 7 },
];

export type SweepResult = {
  hearingsExamined: number;
  remindersSent: number;
  recipientsNotified: number;
  /** Recipients whose notification could not be recorded. Should be zero. */
  deliveryFailures: number;
  suppressed: number;
};

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / MS_PER_DAY);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

export async function runHearingReminderSweep(
  now: Date = new Date(),
): Promise<SweepResult> {
  const horizon = new Date(now.getTime() + 7 * MS_PER_DAY);

  const hearings = await prisma.hearing.findMany({
    where: { date: { gte: now, lte: horizon } },
    select: {
      id: true,
      date: true,
      court: true,
      purpose: true,
      caseId: true,
      case: {
        select: {
          caseNumber: true,
          title: true,
          assignments: { select: { userId: true } },
        },
      },
      reminders: { select: { offset: true } },
    },
  });

  const result: SweepResult = {
    hearingsExamined: hearings.length,
    remindersSent: 0,
    recipientsNotified: 0,
    deliveryFailures: 0,
    suppressed: 0,
  };

  for (const hearing of hearings) {
    const remaining = daysUntil(hearing.date, now);
    const alreadySent = new Set(hearing.reminders.map((r) => r.offset));

    // The most urgent bucket this hearing currently sits in.
    const current = BUCKETS.find((bucket) => remaining <= bucket.days);
    if (!current || alreadySent.has(current.offset)) continue;

    // Any less urgent bucket is past its moment; record it so it cannot fire
    // after the more urgent one has already gone out.
    const staleOffsets = BUCKETS.filter(
      (bucket) => bucket.days > current.days && !alreadySent.has(bucket.offset),
    ).map((bucket) => bucket.offset);

    try {
      await prisma.hearingReminder.createMany({
        data: [current.offset, ...staleOffsets].map((offset) => ({
          hearingId: hearing.id,
          offset,
        })),
        // Concurrent sweeps race here; the unique constraint is the arbiter.
        skipDuplicates: true,
      });
    } catch (error) {
      console.error(
        `Could not record reminder for hearing ${hearing.id}`,
        error,
      );
      continue;
    }

    result.suppressed += staleOffsets.length;

    const label = current.days === 1 ? "tomorrow" : `in ${current.days} days`;

    const recipients = hearing.case.assignments.map((a) => a.userId);

    for (const userId of recipients) {
      const delivered = await deliver({
        userId,
        kind: "HEARING_REMINDER",
        title: `Hearing ${label}: ${hearing.case.caseNumber}`,
        body: `${hearing.case.title} — ${hearing.purpose} at ${hearing.court} on ${formatDate(hearing.date)}.`,
        linkUrl: `/cases/${hearing.caseId}/hearings`,
      });

      // Count what actually landed, not what was attempted.
      if (delivered) result.recipientsNotified += 1;
      else result.deliveryFailures += 1;
    }

    result.remindersSent += 1;
  }

  return result;
}
