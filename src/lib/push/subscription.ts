import { z } from "zod";

/** Remembers which subscription this browser owns, so sign-out can remove it. */
export const PUSH_DEVICE_COOKIE = "portal_push_device";

/**
 * Validation for browser push subscriptions. Pure, so it is unit-tested.
 *
 * The server later POSTs to the endpoint, so an unchecked endpoint would let
 * any signed-in user make the server call arbitrary URLs (SSRF). Only the
 * push services real browsers use are accepted.
 */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge (Android), Opera, Samsung Internet
  "android.googleapis.com",
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari, iOS home-screen apps
  "notify.windows.com", // Edge on Windows (*.notify.windows.com)
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "") return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

const base64url = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).max(200);

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isAllowedPushEndpoint, "Unsupported push service."),
  keys: z.object({ p256dh: base64url, auth: base64url }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/** "Chrome on Android", "Safari on iPhone" — only for recognising devices in settings. */
export function describeDevice(userAgent: string): string {
  const ua = userAgent;
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Browser";
  return `${browser} on ${os}`;
}
