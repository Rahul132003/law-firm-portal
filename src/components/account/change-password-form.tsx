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
  return <p className="mt-1 text-xs text-red-700">{message}</p>;
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
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 border border-sky-300 text-sky-700 text-lg shadow-sm"
        >
          🔒
        </span>
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-slate-900">
            Change Password
          </h2>
          <p className="text-xs font-semibold text-slate-500">
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
          className="mt-4 max-w-md rounded-xl border-2 border-rose-400 bg-rose-50 p-4 text-sm font-bold text-rose-950 shadow-sm flex items-start gap-2.5"
        >
          <span className="text-rose-600 text-lg">⚠️</span>
          <span>{state.message}</span>
        </div>
      ) : null}

      {state.ok ? (
        <div
          role="status"
          className="mt-4 max-w-md rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 text-sm font-bold text-emerald-950 shadow-md flex items-start gap-2.5"
        >
          <span className="text-emerald-600 text-lg">✅</span>
          <div className="flex-1">
            <p className="font-extrabold text-emerald-900">{state.message}</p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-800">
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
