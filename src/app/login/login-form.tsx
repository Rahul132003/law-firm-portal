"use client";

import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { useActionState, useState } from "react";

import { login, type LoginState } from "./actions";

const INITIAL: LoginState = {};

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(login, INITIAL);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full">
      <form action={formAction} className="space-y-5">
        {notice ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-medium text-warning"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-warning" />
            <span>{notice}</span>
          </div>
        ) : null}

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block font-serif text-sm font-bold text-primary"
          >
            Email Address
          </label>
          <div className="relative flex items-center rounded-2xl border border-transparent bg-[#edf4ff] transition-all focus-within:border-[#00a8e8]/50 focus-within:bg-white focus-within:ring-4 focus-within:ring-[#00a8e8]/10">
            <div className="pointer-events-none pl-4 text-muted">
              <Mail className="h-5 w-5 text-muted" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              disabled={pending}
              className="w-full bg-transparent py-3.5 pl-3 pr-4 text-sm font-medium text-primary placeholder:text-muted focus:outline-none disabled:opacity-60"
              placeholder="you@lawfirm.com"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block font-serif text-sm font-bold text-primary"
          >
            Password
          </label>
          <div className="relative flex items-center rounded-2xl border border-transparent bg-[#edf4ff] transition-all focus-within:border-[#00a8e8]/50 focus-within:bg-white focus-within:ring-4 focus-within:ring-[#00a8e8]/10">
            <div className="pointer-events-none pl-4 text-muted">
              <Lock className="h-5 w-5 text-muted" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={pending}
              className="w-full bg-transparent py-3.5 pl-3 pr-10 text-sm font-medium text-primary placeholder:text-muted focus:outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 text-muted hover:text-secondary focus:outline-none"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {state.error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
          >
            {state.error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00a8e8] py-4 font-serif text-base font-bold text-white shadow-lg shadow-[#00a8e8]/25 transition-all duration-200 hover:bg-[#0096c7] hover:shadow-cyan-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing In…" : "Sign In to Dashboard"}
        </button>
      </form>
    </div>
  );
}
