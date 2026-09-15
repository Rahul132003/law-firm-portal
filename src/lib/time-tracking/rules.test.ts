import { describe, expect, it } from "vitest";
import {
  addDays,
  checkEntryLimits,
  dayInTimeZone,
  elapsedMinutes,
  formatMinutes,
  parseDay,
  parseDuration,
  startOfWeek,
  timeEntrySchema,
  toDayString,
  weekDays,
} from "./rules";

describe("parseDuration", () => {
  it.each([
    ["1:30", 90],
    ["0:45", 45],
    ["1.5", 90],
    ["2", 120],
    ["0.25", 15],
    ["45", 45],
    ["90", 90],
    ["1h 30m", 90],
    ["1h", 60],
    ["2 hours", 120],
    ["45m", 45],
    ["45 mins", 45],
    ["1.5h", 90],
  ])("%s → %i minutes", (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each(["", "abc", "0", "0:00", "1:75", "25:00", "1500", "-1", "1h 30x"])(
    "rejects %j",
    (input) => {
      expect(parseDuration(input)).toBeNull();
    },
  );
});

describe("calendar days", () => {
  it("round-trips a day string without time-zone drift", () => {
    expect(toDayString(parseDay("2026-03-01")!)).toBe("2026-03-01");
  });

  it("places an instant on the firm's calendar day, not UTC's", () => {
    // 01:00 IST on 17 Sep is still 16 Sep in UTC.
    const instant = new Date("2026-09-16T19:30:00Z");
    expect(toDayString(dayInTimeZone(instant, "Asia/Kolkata"))).toBe("2026-09-17");
    expect(toDayString(dayInTimeZone(instant, "UTC"))).toBe("2026-09-16");
  });

  it("rejects impossible dates", () => {
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("16/09/2026")).toBeNull();
  });

  it("finds Monday for any day of the week, including Sunday", () => {
    expect(toDayString(startOfWeek(parseDay("2026-09-16")!))).toBe("2026-09-14"); // Wed
    expect(toDayString(startOfWeek(parseDay("2026-09-20")!))).toBe("2026-09-14"); // Sun
    expect(toDayString(startOfWeek(parseDay("2026-09-14")!))).toBe("2026-09-14"); // Mon
  });

  it("lists the seven days of a week across a month boundary", () => {
    expect(weekDays(parseDay("2026-09-28")!).map(toDayString)).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30",
      "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
  });
});

describe("formatting and timers", () => {
  it("formats minutes", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(125)).toBe("2h 05m");
  });

  it("rounds elapsed time to the nearest minute", () => {
    const start = new Date("2026-09-16T10:00:00Z");
    expect(elapsedMinutes(start, new Date("2026-09-16T10:00:29Z"))).toBe(0);
    expect(elapsedMinutes(start, new Date("2026-09-16T10:44:31Z"))).toBe(45);
  });
});

describe("timeEntrySchema", () => {
  const valid = {
    caseId: "",
    workDate: "2026-09-16",
    duration: "1:15",
    activity: "DRAFTING",
    description: "Drafted written statement",
  };

  it("parses a valid entry, treating a blank case as firm work", () => {
    const parsed = timeEntrySchema.parse(valid);
    expect(parsed).toMatchObject({ caseId: null, minutes: 75, activity: "DRAFTING" });
    expect(toDayString(parsed.workDate)).toBe("2026-09-16");
  });

  it("reports field-level errors", () => {
    const result = timeEntrySchema.safeParse({ ...valid, duration: "lots", workDate: "nope" });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("workDate");
  });
});

describe("checkEntryLimits", () => {
  const today = parseDay("2026-09-16")!;

  it("rejects future days", () => {
    expect(
      checkEntryLimits({ workDate: addDays(today, 1), minutes: 30, otherMinutesThatDay: 0, latestAllowedDay: today }),
    ).toHaveProperty("workDate");
  });

  it("caps a day at 24 hours and says how much still fits", () => {
    const errors = checkEntryLimits({ workDate: today, minutes: 120, otherMinutesThatDay: 23 * 60, latestAllowedDay: today });
    expect(errors?.duration).toMatch(/at most 1h 00m more/);
  });

  it("accepts an entry within limits", () => {
    expect(
      checkEntryLimits({ workDate: today, minutes: 60, otherMinutesThatDay: 8 * 60, latestAllowedDay: today }),
    ).toBeNull();
  });
});
