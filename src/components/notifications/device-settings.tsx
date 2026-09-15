"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonClass } from "@/components/ui/button";
import { removeDevice, sendTestPush, setPushHideDetails } from "@/lib/push/actions";
import { usePush } from "./use-push";

type Device = { id: string; deviceName: string | null; lastSeenAt: Date; isThisDevice: boolean };

const seenFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function DeviceSettings({
  devices,
  hideDetails,
  registeredOnServer,
}: {
  devices: Device[];
  hideDetails: boolean;
  registeredOnServer: boolean;
}) {
  const router = useRouter();
  const { status, error, busy, enable, disable } = usePush(registeredOnServer);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const statusText: Record<typeof status, string> = {
    loading: "Checking this browser…",
    unsupported: "This browser cannot receive device notifications. Try Chrome, Edge, Firefox or Safari.",
    "ios-needs-install":
      "On iPhone and iPad, add the portal to your Home Screen (Share → Add to Home Screen), open it from there, then turn notifications on.",
    "not-configured": "Device notifications have not been set up on the server yet. Ask your administrator.",
    prompt: "Off on this device.",
    denied:
      "Blocked in this browser's settings. Allow notifications for this site in the browser's site settings, then reload.",
    enabled: "On for this device.",
    "granted-not-registered": "Off on this device.",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">This device</p>
          <p className={`text-xs ${status === "enabled" ? "text-success" : status === "denied" ? "text-danger" : "text-secondary"}`}>
            {statusText[status]}
          </p>
          {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {status === "prompt" || status === "granted-not-registered" ? (
            <button type="button" disabled={busy} onClick={async () => { await enable(); router.refresh(); }} className={buttonClass("primary", "sm")}>
              {busy ? "Turning on…" : "Turn on"}
            </button>
          ) : null}
          {status === "enabled" ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await sendTestPush();
                    setMessage(result.message);
                  })
                }
                className={buttonClass("secondary", "sm")}
              >
                Send test
              </button>
              <button type="button" disabled={busy} onClick={async () => { await disable(); router.refresh(); }} className={buttonClass("secondary", "sm")}>
                Turn off
              </button>
            </>
          ) : null}
        </div>
      </div>
      {message ? <p role="status" className="text-xs text-secondary">{message}</p> : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline px-4 py-3">
        <input
          type="checkbox"
          defaultChecked={hideDetails}
          disabled={pending}
          onChange={(event) => {
            const hide = event.currentTarget.checked;
            startTransition(async () => {
              await setPushHideDetails(hide);
            });
          }}
          className="mt-1"
        />
        <span>
          <span className="block text-sm text-primary">Hide case details on lock screens</span>
          <span className="block text-xs text-secondary">
            Device alerts will say only what kind of update it is (for example &ldquo;Hearing reminders&rdquo;),
            never client, party or case names. Recommended if others can see your phone.
          </span>
        </span>
      </label>

      {devices.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Your devices</p>
          <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-primary">{device.deviceName ?? "Unknown device"}</span>
                  {device.isThisDevice ? <span className="ml-2 text-xs text-accent-700">this device</span> : null}
                  <span className="block text-xs text-muted">Last active {seenFormat.format(device.lastSeenAt)}</span>
                </span>
                {!device.isThisDevice ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await removeDevice(device.id);
                        router.refresh();
                      })
                    }
                    className="rounded-md border border-hairline px-2 py-1 text-[11px] text-secondary hover:bg-sunken"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
