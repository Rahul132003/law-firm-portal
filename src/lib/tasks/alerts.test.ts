import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(),
  prisma: {
    task: { findMany: vi.fn() },
    taskAlert: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/notifications/deliver", () => ({ deliver: mocks.deliver }));

const { runTaskDeadlineSweep } = await import("./alerts");

const NOW = new Date("2026-09-15T07:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

type Kind = "GENERAL" | "FILING_DEADLINE" | "LIMITATION_DEADLINE";

function task(kind: Kind, daysOut: number, sent: string[] = [], caseId: string | null = "c1") {
  return {
    id: `t-${kind}-${daysOut}`,
    description: "File written statement",
    dueDate: new Date(NOW.getTime() + daysOut * DAY),
    kind,
    caseId,
    assignedTo: { id: "u1" },
    case: caseId ? { caseNumber: "CS-1/2026", title: "X v Y" } : null,
    alerts: sent.map((offset) => ({ offset })),
  };
}

const recordedOffsets = () =>
  mocks.prisma.taskAlert.createMany.mock.calls.map((call) =>
    call[0].data.map((row: { offset: string }) => row.offset),
  );

beforeEach(() => {
  vi.resetAllMocks();
  mocks.deliver.mockResolvedValue(true);
  mocks.prisma.taskAlert.createMany.mockResolvedValue({ count: 1 });
});

describe("runTaskDeadlineSweep lead times", () => {
  it.each([
    ["GENERAL", 5, null],
    ["GENERAL", 2.5, "DAY_3"],
    ["FILING_DEADLINE", 20, null],
    ["FILING_DEADLINE", 13, "DAY_14"],
    ["LIMITATION_DEADLINE", 29, "DAY_30"],
  ] as const)("%s due in %s days alerts at %s", async (kind, days, expected) => {
    mocks.prisma.task.findMany.mockResolvedValue([task(kind, days)]);

    await runTaskDeadlineSweep(NOW);

    if (expected === null) {
      expect(mocks.prisma.taskAlert.createMany).not.toHaveBeenCalled();
      expect(mocks.deliver).not.toHaveBeenCalled();
    } else {
      expect(recordedOffsets()[0]![0]).toBe(expected);
      expect(mocks.deliver).toHaveBeenCalledTimes(1);
    }
  });
});

describe("runTaskDeadlineSweep behaviour", () => {
  it("suppresses only the stale buckets within the kind's lead time", async () => {
    mocks.prisma.task.findMany.mockResolvedValue([task("FILING_DEADLINE", 2)]);

    const result = await runTaskDeadlineSweep(NOW);

    // DAY_30 is outside a filing deadline's 14-day lead and must not be written.
    expect(recordedOffsets()).toEqual([["DAY_3", "DAY_7", "DAY_14"]]);
    expect(result.suppressed).toBe(2);
  });

  it("escalates past-due tasks once as OVERDUE", async () => {
    mocks.prisma.task.findMany.mockResolvedValue([
      task("LIMITATION_DEADLINE", -2, ["DAY_30", "DAY_14", "DAY_7", "DAY_3", "DAY_1"]),
    ]);

    const result = await runTaskDeadlineSweep(NOW);

    expect(recordedOffsets()).toEqual([["OVERDUE"]]);
    expect(mocks.deliver.mock.calls[0]![0].title).toMatch(/^Overdue deadline/);
    expect(result.overdueAlerts).toBe(1);
  });

  it("never repeats the OVERDUE escalation", async () => {
    mocks.prisma.task.findMany.mockResolvedValue([task("GENERAL", -5, ["OVERDUE"])]);

    await runTaskDeadlineSweep(NOW);

    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("links personal tasks to /tasks", async () => {
    mocks.prisma.task.findMany.mockResolvedValue([task("GENERAL", 1, [], null)]);

    await runTaskDeadlineSweep(NOW);

    expect(mocks.deliver.mock.calls[0]![0]).toMatchObject({
      userId: "u1",
      linkUrl: "/tasks",
      body: expect.stringMatching(/^Personal task/),
    });
  });
});
