import { z } from "zod";
import type { TimeActivity } from "@/generated/prisma/enums";

/**
 * Time-tracking rules. Pure: shared by server actions, pages and tests.
 *
 * Dates are calendar days ("2026-09-16"), carried as `YYYY-MM-DD` strings in
 * forms and URLs and stored as UTC-midnight `Date`s in a DATE column, so a day
 * never shifts when server and browser sit in different time zones.
 */

export const MAX_MINUTES_PER_ENTRY = 24 * 60;
export const MAX_MINUTES_PER_DAY = 24 * 60;
/** A timer running longer than this was almost certainly forgotten. */
export const MAX_TIMER_MINUTES = 12 * 60;

export const TIME_ACTIVITY_LABELS: Record<TimeActivity, string> = {
  RESEARCH: "Research",
  DRAFTING: "Drafting",
  HEARING: "Court appearance",
  CLIENT_MEETING: "Client meeting",
  CORRESPONDENCE: "Correspondence",
  REVIEW: "Review",
  TRAVEL: "Travel",
  ADMIN: "Firm admin",
  OTHER: "Other",
};

export const TIME_ACTIVITY_ORDER = Object.keys(TIME_ACTIVITY_LABELS) as TimeActivity[];

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Parses `YYYY-MM-DD` to UTC midnight, or null if it is not a real date. */
export function parseDay(value: string): Date | null {
  if (!ISO_DAY.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || toDayString(date) !== value ? null : date;
}

export function toDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The calendar day an instant falls on in `timeZone`, as UTC midnight. */
export function dayInTimeZone(instant: Date, timeZone: string): Date {
  // en-CA formats as YYYY-MM-DD.
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return parseDay(day)!;
}

export function addDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * DAY_MS);
}

/** Monday of the week containing `day`. */
export function startOfWeek(day: Date): Date {
  const weekday = (day.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
}

export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** "2h 05m", "45m", "0m". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/** Decimal hours for totals, e.g. 7.5. */
export function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Accepts the ways people naturally type a duration: "1:30", "1.5", "1h 30m",
 * "90m", "90". A bare number up to 12 is read as hours, above that as minutes,
 * matching how "2" and "45" are usually meant.
 */
export function parseDuration(input: string): number | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;

  let minutes: number;
  const clock = value.match(/^(\d{1,2}):([0-5]\d)$/);
  const units = value.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?|s)?)?)?$/);

  if (clock) {
    minutes = Number(clock[1]) * 60 + Number(clock[2]);
  } else if (/^\d+(?:\.\d+)?$/.test(value)) {
    const number = Number(value);
    minutes = number <= 12 ? Math.round(number * 60) : Math.round(number);
  } else if (units && (units[1] || units[2])) {
    minutes = Math.round(Number(units[1] ?? 0) * 60) + Number(units[2] ?? 0);
  } else {
    return null;
  }

  return minutes >= 1 && minutes <= MAX_MINUTES_PER_ENTRY ? minutes : null;
}

/** Whole minutes a timer has run, rounded to the nearest minute. */
export function elapsedMinutes(startedAt: Date, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60_000));
}

export const timeEntrySchema = z
  .object({
    caseId: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value)),
    workDate: z.string().trim(),
    duration: z.string(),
    activity: z.enum(TIME_ACTIVITY_ORDER as [TimeActivity, ...TimeActivity[]], {
      message: "Choose what the time was spent on.",
    }),
    description: z
      .string()
      .trim()
      .min(3, "Describe the work in a few words.")
      .max(1000, "Keep the description under 1000 characters."),
  })
  .transform((input, ctx) => {
    const day = parseDay(input.workDate);
    if (!day) {
      ctx.addIssue({ code: "custom", path: ["workDate"], message: "Choose a valid date." });
      return z.NEVER;
    }
    const minutes = parseDuration(input.duration);
    if (minutes === null) {
      ctx.addIssue({
        code: "custom",
        path: ["duration"],
        message: "Enter a duration such as 1:30, 1.5 or 45m (up to 24 hours).",
      });
      return z.NEVER;
    }
    return {
      caseId: input.caseId,
      workDate: day,
      minutes,
      activity: input.activity,
      description: input.description,
    };
  });

export type TimeEntryInput = z.output<typeof timeEntrySchema>;

/**
 * Checks that make sense only with context: the date is not in the future and
 * the day's total stays within 24 hours. `today` is the latest calendar day
 * accepted; callers pass tomorrow-in-UTC to tolerate time-zone differences.
 */
export function checkEntryLimits(input: {
  workDate: Date;
  minutes: number;
  otherMinutesThatDay: number;
  latestAllowedDay: Date;
}): Record<string, string> | null {
  if (input.workDate.getTime() > input.latestAllowedDay.getTime()) {
    return { workDate: "Time cannot be recorded for a future date." };
  }
  if (input.otherMinutesThatDay + input.minutes > MAX_MINUTES_PER_DAY) {
    const left = Math.max(0, MAX_MINUTES_PER_DAY - input.otherMinutesThatDay);
    return {
      duration: `That day already has ${formatMinutes(input.otherMinutesThatDay)} recorded; at most ${formatMinutes(left)} more fits.`,
    };
  }
  return null;
}
