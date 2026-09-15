"use client";
import { useState, useTransition } from "react";

import { buttonClass } from "@/components/ui/button";
import type { NotificationKind } from "@/generated/prisma/enums";
import { saveNotificationPreferences } from "@/lib/notifications/actions";
import { NOTIFICATION_KINDS } from "@/lib/notifications/kinds";

export function PreferencesForm({
  kinds,
  muted,
}: {
  /** Kinds relevant to this person's role, in display order. */
  kinds: NotificationKind[];
  muted: NotificationKind[];
}) {
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const mandatory = kinds.filter((k) => NOTIFICATION_KINDS[k].mandatory);
  const optional = kinds.filter((k) => !NOTIFICATION_KINDS[k].mandatory);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const enabled = new FormData(event.currentTarget).getAll("enabled").map(String);
        startTransition(async () => {
          await saveNotificationPreferences(enabled);
          setSaved(true);
        });
      }}
      onChange={() => setSaved(false)}
      className="space-y-6"
    >
      <fieldset>
        <legend className="text-sm font-semibold text-primary">Always on</legend>
        <p className="mt-0.5 text-xs text-muted">
          Missing one of these can cost a hearing or a limitation period, so they cannot be turned off.
        </p>
        <ul className="mt-3 space-y-2">
          {mandatory.map((kind) => (
            <li key={kind} className="flex items-start gap-3 rounded-lg border border-hairline px-3 py-2.5">
              <input type="checkbox" checked disabled className="mt-1" aria-label={NOTIFICATION_KINDS[kind].label} />
              <span>
                <span className="block text-sm text-primary">{NOTIFICATION_KINDS[kind].label}</span>
                <span className="block text-xs text-secondary">{NOTIFICATION_KINDS[kind].description}</span>
              </span>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-primary">Activity on your work</legend>
        <p className="mt-0.5 text-xs text-muted">You are never notified about your own actions.</p>
        <ul className="mt-3 space-y-2">
          {optional.map((kind) => (
            <li key={kind}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline px-3 py-2.5 hover:bg-sunken/50">
                <input
                  type="checkbox"
                  name="enabled"
                  value={kind}
                  defaultChecked={!muted.includes(kind)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm text-primary">{NOTIFICATION_KINDS[kind].label}</span>
                  <span className="block text-xs text-secondary">{NOTIFICATION_KINDS[kind].description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          {pending ? "Saving…" : "Save preferences"}
        </button>
        {saved ? <span role="status" className="text-xs text-success">Saved.</span> : null}
      </div>
    </form>
  );
}
