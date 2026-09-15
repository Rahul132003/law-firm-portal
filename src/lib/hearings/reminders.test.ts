import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(),
  prisma: {
    hearing: { findMany: vi.fn() },
    hearingReminder: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/notifications/deliver", () => ({ deliver: mocks.deliver }));

const { runHearingReminderSweep } = await import("./reminders");

const NOW = new Date("2026-09-15T07:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function hearing(daysOut: number, sent: string[] = [], assignees = ["a", "b"]) {
  return {
    id: `h${daysOut}`,
    date: new Date(NOW.getTime() + daysOut * DAY),
    court: "High Court",
    purpose: "Arguments",
    caseId: "c1",
    case: {
      caseNumber: "CS-1/2026",
      title: "X v Y",
      assignments: assignees.map((userId) => ({ userId })),
    },
    reminders: sent.map((offset) => ({ offset })),
  };
}

const recordedOffsets = () =>
  mocks.prisma.hearingReminder.createMany.mock.calls.map((call) =>
    call[0].data.map((row: { offset: string }) => row.offset),
  );

beforeEach(() => {
  vi.resetAllMocks();
  mocks.deliver.mockResolvedValue(true);
  mocks.prisma.hearingReminder.createMany.mockResolvedValue({ count: 1 });
});

describe("runHearingReminderSweep", () => {
  it("sends the 7-day reminder to every assignee", async () => {
    mocks.prisma.hearing.findMany.mockResolvedValue([hearing(6.5)]);

    const result = await runHearingReminderSweep(NOW);

    expect(recordedOffsets()).toEqual([["DAY_7"]]);
    expect(mocks.deliver).toHaveBeenCalledTimes(2);
    expect(mocks.deliver.mock.calls[0]![0].title).toMatch(/in 7 days/);
    expect(result).toMatchObject({ remindersSent: 1, recipientsNotified: 2, suppressed: 0 });
  });

  it("fires only the most urgent bucket and suppresses stale ones", async () => {
    mocks.prisma.hearing.findMany.mockResolvedValue([hearing(0.5)]);

    const result = await runHearingReminderSweep(NOW);

    expect(recordedOffsets()).toEqual([["DAY_1", "DAY_3", "DAY_7"]]);
    expect(mocks.deliver.mock.calls[0]![0].title).toMatch(/tomorrow/);
    expect(result.suppressed).toBe(2);
  });

  it("does not resend a bucket already recorded", async () => {
    mocks.prisma.hearing.findMany.mockResolvedValue([hearing(2.5, ["DAY_3", "DAY_7"])]);

    const result = await runHearingReminderSweep(NOW);

    expect(mocks.prisma.hearingReminder.createMany).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
  });

  it("catches up after a missed day instead of skipping", async () => {
    // The 7-day reminder went out; the sweep then missed the day the hearing
    // crossed into the 3-day window. It is now 2 days out.
    mocks.prisma.hearing.findMany.mockResolvedValue([hearing(2, ["DAY_7"])]);

    await runHearingReminderSweep(NOW);

    expect(recordedOffsets()).toEqual([["DAY_3"]]);
    expect(mocks.deliver).toHaveBeenCalled();
  });

  it("sends nothing if the dispatch row cannot be recorded", async () => {
    mocks.prisma.hearing.findMany.mockResolvedValue([hearing(1)]);
    mocks.prisma.hearingReminder.createMany.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runHearingReminderSweep(NOW);

    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
  });

  it("counts delivery failures rather than reporting success", async () => {
    mocks.prisma.hearing.findMany.mockResolvedValue([hearing(1)]);
    mocks.deliver.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await runHearingReminderSweep(NOW);

    expect(result).toMatchObject({ recipientsNotified: 1, deliveryFailures: 1 });
  });
});
