"use client";

import { useState, useTransition } from "react";

import { buttonClass } from "@/components/ui/button";
import {
  changePassword,
  type ChangePasswordState,
} from "@/lib/account/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/account/validation";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-danger">{message}</p>;
}

export function ChangePasswordForm() {
  const [state, setState] = useState<ChangePasswordState>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        startTransition(async () => {
          const result = await changePassword({}, formData);
          setState(result);
          // Never leave a typed password sitting in the DOM after success.
          if (result.ok) form.reset();
        });
      }}
      className="card p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-2">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 border border-accent-200 text-accent-700 text-lg shadow-sm"
        >
          🔒
        </span>
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-primary">
            Change Password
          </h2>
          <p className="text-xs font-semibold text-muted">
            You will need your current password to make this change.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="currentPassword" className="field-label">
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="field-input max-w-md text-base"
          />
          <FieldError message={state.errors?.currentPassword} />
        </div>

        <div>
          <label htmlFor="newPassword" className="field-label">
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            disabled={pending}
            className="field-input max-w-md text-base"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          />
          <FieldError message={state.errors?.newPassword} />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="field-label">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            disabled={pending}
            className="field-input max-w-md text-base"
          />
          <FieldError message={state.errors?.confirmPassword} />
        </div>
      </div>

      {state.message && !state.ok ? (
        <div
          role="alert"
          className="mt-4 max-w-md rounded-xl border-2 border-danger/40 bg-danger-soft p-4 text-sm font-bold text-danger shadow-sm flex items-start gap-2.5"
        >
          <span className="text-danger text-lg">⚠️</span>
          <span>{state.message}</span>
        </div>
      ) : null}

      {state.ok ? (
        <div
          role="status"
          className="mt-4 max-w-md rounded-xl border-2 border-success/40 bg-success-soft p-4 text-sm font-bold text-success shadow-md flex items-start gap-2.5"
        >
          <span className="text-success text-lg">✅</span>
          <div className="flex-1">
            <p className="font-extrabold text-success">{state.message}</p>
            <p className="mt-0.5 text-xs font-semibold text-success">
              Use your new password next time you sign in.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "md")}
        >
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
