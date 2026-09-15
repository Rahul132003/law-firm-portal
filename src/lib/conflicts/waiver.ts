/**
 * Decides whether a case save may proceed given a conflict report and what the
 * user submitted. Pure, so the gating rules are unit-tested directly.
 */

export const MIN_WAIVER_REASON = 20;
export const MAX_WAIVER_REASON = 2000;

export type WaiverSubmission = {
  acknowledged: boolean;
  /** The fingerprint of the report the user was shown when they acknowledged. */
  fingerprint: string;
  reason: string;
};

export type WaiverDecision =
  | { ok: true; outcome: "CLEAR" | "WAIVED"; waiverReason: string | null }
  | { ok: false; message: string; errors?: Record<string, string> };

export function readWaiver(formData: FormData): WaiverSubmission {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    acknowledged: formData.get("conflictAcknowledged") === "on",
    fingerprint: text("conflictFingerprint"),
    reason: text("waiverReason"),
  };
}

export function decideWaiver(
  report: { adverseCount: number; fingerprint: string },
  submission: WaiverSubmission,
): WaiverDecision {
  if (report.adverseCount === 0) {
    return { ok: true, outcome: "CLEAR", waiverReason: null };
  }

  if (!submission.acknowledged) {
    return {
      ok: false,
      message:
        "Possible conflicts of interest were found. Review them below and record why the firm may act before saving.",
    };
  }

  if (submission.fingerprint !== report.fingerprint) {
    return {
      ok: false,
      message:
        "The conflicts found have changed since you reviewed them. Review the updated list and confirm again.",
    };
  }

  const reason = submission.reason.trim();
  if (reason.length < MIN_WAIVER_REASON) {
    return {
      ok: false,
      message: "A reason is required to proceed despite a conflict.",
      errors: {
        waiverReason: `Explain why the firm may act (at least ${MIN_WAIVER_REASON} characters).`,
      },
    };
  }
  if (reason.length > MAX_WAIVER_REASON) {
    return {
      ok: false,
      message: "The reason is too long.",
      errors: { waiverReason: `Keep it under ${MAX_WAIVER_REASON} characters.` },
    };
  }

  return { ok: true, outcome: "WAIVED", waiverReason: reason };
}
