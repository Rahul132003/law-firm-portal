"use client";
import { BellRing, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { usePush } from "./use-push";

const DISMISS_KEY = "portal_push_prompt_dismissed_at";
/** After "Not now", ask again a week later rather than never. */
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function wasSnoozed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * Banner asking to turn on device notifications. The browser's own permission
 * dialog only appears after the user presses "Turn on" — browsers suppress
 * prompts that are not triggered by a click, and asking before explaining is
 * the fastest way to get "Block".
 */
export function PushPrompt({ registeredOnServer }: { registeredOnServer: boolean }) {
  const { status, error, busy, enable } = usePush(registeredOnServer);
  const [hidden, setHidden] = useState(false);

  const askable = status === "prompt" || status === "granted-not-registered" || status === "ios-needs-install";
  if (!askable || hidden || wasSnoozed()) return null;

  function snooze() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Storage unavailable: hide for this page view only.
    }
    setHidden(true);
  }

  return (
    <div
      role="region"
      aria-label="Device notifications"
      className="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent-600/30 bg-accent-50 px-4 py-3 md:mx-8"
    >
      <BellRing className="size-5 shrink-0 text-accent-700" strokeWidth={1.75} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        {status === "ios-needs-install" ? (
          <>
            <p className="font-medium text-primary">Get hearing and case alerts on this iPhone</p>
            <p className="text-xs text-secondary">
              Tap the Share button, choose <strong>Add to Home Screen</strong>, then open the portal from the new icon
              and turn notifications on.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-primary">Get alerts on this device, even when the portal is closed</p>
            <p className="text-xs text-secondary">
              Hearing reminders, deadlines, and updates from your team.{" "}
              <Link href="/settings/notifications" className="underline-offset-2 hover:underline">
                Choose which
              </Link>
              .
            </p>
          </>
        )}
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {status !== "ios-needs-install" ? (
          <button type="button" disabled={busy} onClick={enable} className={buttonClass("primary", "sm")}>
            {busy ? "Turning on…" : "Turn on"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={snooze}
          aria-label="Not now"
          className="rounded-md p-1.5 text-secondary hover:bg-accent-100"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
