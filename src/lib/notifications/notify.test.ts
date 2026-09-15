import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deliverBatch: vi.fn(),
  prisma: { user: { findMany: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("./deliver", () => ({ deliverBatch: mocks.deliverBatch }));

const { notify } = await import("./notify");
const { wantsKind } = await import("./kinds");

const event = {
  title: "t",
  body: "b",
  linkUrl: "/x",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.deliverBatch.mockImplementation(async (rows: unknown[]) => rows.length);
});

describe("wantsKind", () => {
  it("honours mutes for optional kinds only", () => {
    expect(wantsKind("DOCUMENT_UPLOADED", ["DOCUMENT_UPLOADED"])).toBe(false);
    expect(wantsKind("DOCUMENT_UPLOADED", [])).toBe(true);
    expect(wantsKind("HEARING_REMINDER", ["HEARING_REMINDER"])).toBe(true);
    expect(wantsKind("CONFLICT_WAIVED", ["CONFLICT_WAIVED"])).toBe(true);
  });
});

describe("notify", () => {
  it("never notifies the actor and collapses duplicate recipients", async () => {
    mocks.prisma.user.findMany.mockResolvedValue([{ id: "b", mutedNotificationKinds: [] }]);

    await notify({ ...event, kind: "CASE_ASSIGNED", recipientIds: ["a", "b", "b"], actorId: "a" });

    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["b"] }, isActive: true } }),
    );
    expect(mocks.deliverBatch.mock.calls[0]![0].map((r: { userId: string }) => r.userId)).toEqual(["b"]);
  });

  it("does not query at all when the actor is the only recipient", async () => {
    expect(await notify({ ...event, kind: "TASK_ASSIGNED", recipientIds: ["a"], actorId: "a" })).toBe(0);
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("skips people who muted an optional kind", async () => {
    mocks.prisma.user.findMany.mockResolvedValue([
      { id: "b", mutedNotificationKinds: ["DOCUMENT_UPLOADED"] },
      { id: "c", mutedNotificationKinds: [] },
    ]);

    const sent = await notify({ ...event, kind: "DOCUMENT_UPLOADED", recipientIds: ["b", "c"], actorId: null });

    expect(sent).toBe(1);
    expect(mocks.deliverBatch.mock.calls[0]![0][0].userId).toBe("c");
  });

  it("delivers mandatory kinds even when muted", async () => {
    mocks.prisma.user.findMany.mockResolvedValue([{ id: "b", mutedNotificationKinds: ["NOTICE_POSTED"] }]);
    expect(await notify({ ...event, kind: "NOTICE_POSTED", recipientIds: ["b"], actorId: null })).toBe(1);
  });

  it("swallows delivery failures so the originating save still succeeds", async () => {
    mocks.prisma.user.findMany.mockResolvedValue([{ id: "b", mutedNotificationKinds: [] }]);
    mocks.deliverBatch.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      notify({ ...event, kind: "TASK_ASSIGNED", recipientIds: ["b"], actorId: null }),
    ).resolves.toBe(0);
  });
});
