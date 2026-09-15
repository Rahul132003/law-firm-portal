import { describe, expect, it } from "vitest";
import { decideWaiver, readWaiver } from "./waiver";

const report = { adverseCount: 2, fingerprint: "abc123" };
const good = {
  acknowledged: true,
  fingerprint: "abc123",
  reason: "Former client, matter closed in 2019; informed consent obtained in writing.",
};

describe("decideWaiver", () => {
  it("clears automatically when there is no adverse match", () => {
    expect(decideWaiver({ adverseCount: 0, fingerprint: "" }, { ...good, acknowledged: false })).toEqual({
      ok: true,
      outcome: "CLEAR",
      waiverReason: null,
    });
  });

  it("blocks when adverse matches are not acknowledged", () => {
    const decision = decideWaiver(report, { ...good, acknowledged: false });
    expect(decision.ok).toBe(false);
  });

  it("blocks a waiver given for a different set of conflicts", () => {
    const decision = decideWaiver(report, { ...good, fingerprint: "stale" });
    expect(decision).toMatchObject({ ok: false, message: expect.stringMatching(/changed/) });
  });

  it("requires a substantive reason", () => {
    const decision = decideWaiver(report, { ...good, reason: "  ok  " });
    expect(decision).toMatchObject({ ok: false, errors: { waiverReason: expect.any(String) } });
  });

  it("records a trimmed reason when everything is in order", () => {
    expect(decideWaiver(report, { ...good, reason: `  ${good.reason}  ` })).toEqual({
      ok: true,
      outcome: "WAIVED",
      waiverReason: good.reason,
    });
  });
});

describe("readWaiver", () => {
  it("reads the form fields", () => {
    const form = new FormData();
    form.set("conflictAcknowledged", "on");
    form.set("conflictFingerprint", "abc");
    form.set("waiverReason", "because");
    expect(readWaiver(form)).toEqual({ acknowledged: true, fingerprint: "abc", reason: "because" });
    expect(readWaiver(new FormData()).acknowledged).toBe(false);
  });
});
