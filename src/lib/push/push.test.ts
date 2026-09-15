import { describe, expect, it } from "vitest";
import { buildPushPayload } from "./payload";
import { describeDevice, isAllowedPushEndpoint, pushSubscriptionSchema } from "./subscription";

describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc123",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://web.push.apple.com/QGuQyavXutnMfd",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc", // not https
    "https://fcm.googleapis.com:8443/fcm/send/abc", // custom port
    "https://evil.example/fcm.googleapis.com", // host elsewhere
    "https://fcm.googleapis.com.evil.example/x", // suffix trick
    "https://169.254.169.254/latest/meta-data", // cloud metadata (SSRF)
    "https://localhost/push",
    "not a url",
  ])("rejects %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});

describe("pushSubscriptionSchema", () => {
  it("accepts a browser subscription and rejects malformed keys", () => {
    const sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
    };
    expect(pushSubscriptionSchema.safeParse(sub).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ ...sub, keys: { ...sub.keys, auth: "<script>" } }).success).toBe(false);
  });
});

describe("buildPushPayload", () => {
  const notification = {
    kind: "HEARING_SCHEDULED" as const,
    title: "Hearing moved: CS/12/2026",
    body: "Sneha moved the Arguments hearing to Mon 21 Sep at High Court.",
    linkUrl: "/cases/c1/hearings",
  };

  it("carries the full message when details are allowed", () => {
    expect(buildPushPayload(notification, { firmName: "Firm", hideDetails: false })).toMatchObject({
      title: notification.title,
      body: notification.body,
      url: "/cases/c1/hearings",
      requireInteraction: false,
    });
  });

  it("strips case and party names when details are hidden", () => {
    const payload = buildPushPayload(notification, { firmName: "Firm", hideDetails: true });
    expect(payload.title).toBe("Firm: Hearings scheduled or moved");
    expect(JSON.stringify(payload)).not.toMatch(/CS\/12|Sneha|High Court/);
  });

  it("keeps reminders on screen and never links off-site", () => {
    const payload = buildPushPayload(
      { kind: "HEARING_REMINDER", title: "t", body: "b", linkUrl: "https://evil.example" },
      { firmName: "Firm", hideDetails: false },
    );
    expect(payload.requireInteraction).toBe(true);
    expect(payload.url).toBe("/notifications");
  });
});

describe("describeDevice", () => {
  it("names common browsers", () => {
    expect(describeDevice("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36")).toBe("Chrome on Android");
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iPhone");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0")).toBe("Edge on Windows");
  });
});
