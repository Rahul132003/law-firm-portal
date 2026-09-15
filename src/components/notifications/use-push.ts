"use client";
import { useCallback, useEffect, useState } from "react";

import { removeThisDevice, savePushSubscription } from "@/lib/push/actions";

/**
 * Browser side of device notifications: support detection, the permission
 * prompt, and keeping this browser's subscription registered with the server.
 */

export type PushStatus =
  /** Still detecting (first render). */
  | "loading"
  /** No Web Push in this browser at all. */
  | "unsupported"
  /** iPhone/iPad Safari tab: push needs the portal added to the Home Screen. */
  | "ios-needs-install"
  /** Server has no VAPID keys. */
  | "not-configured"
  /** Not asked yet. */
  | "prompt"
  /** Blocked in browser settings; only the user can undo it. */
  | "denied"
  /** Allowed and registered with the server. */
  | "enabled"
  /** Allowed by the browser, but this device is not registered for this user. */
  | "granted-not-registered";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function subscribe(): Promise<PushSubscription> {
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const current = await reg.pushManager.getSubscription();
  if (current) return current;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
  });
}

/**
 * @param registeredOnServer whether the server already has this browser on
 *   record for the signed-in user (read from an httpOnly cookie by the layout).
 */
export function usePush(registeredOnServer: boolean) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const set = (next: PushStatus) => {
      if (!cancelled) setStatus(next);
    };

    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return set(isIos() && !isStandalone() ? "ios-needs-install" : "unsupported");
      if (!PUBLIC_KEY) return set("not-configured");

      const permission = Notification.permission;
      if (permission === "denied") return set("denied");
      if (permission === "default") return set("prompt");

      if (!registeredOnServer) return set("granted-not-registered");

      // Already allowed and registered: refresh the subscription quietly so
      // rotated keys and a moved device stay correct.
      try {
        const subscription = await subscribe();
        await savePushSubscription(subscription.toJSON());
        set("enabled");
      } catch {
        set("granted-not-registered");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [registeredOnServer]);

  /** Must run from a click: browsers ignore permission requests without one. */
  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "prompt");
        return;
      }
      const subscription = await subscribe();
      const result = await savePushSubscription(subscription.toJSON());
      if (!result.ok) {
        setError(result.message ?? "Could not register this device.");
        return;
      }
      setStatus("enabled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn on notifications.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const subscription = await reg?.pushManager.getSubscription();
      if (subscription) {
        await removeThisDevice(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("granted-not-registered");
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, error, busy, enable, disable };
}
