"use client";

import { useActionState, useState } from "react";
import { Mail, Smartphone, Lock, Eye, EyeOff, Shield, KeyRound, Scale } from "lucide-react";
import { login, type LoginState } from "./actions";

const INITIAL: LoginState = {};

const DEMO_ACCOUNTS = [
  { name: "Shubham", role: "Admin / Partner", email: "admin@example.com", pass: "password123", badge: "Full Access" },
  { name: "Vikrant", role: "Senior Advocate", email: "senior@example.com", pass: "password123", badge: "Team Matters" },
  { name: "Sneha", role: "Associate Advocate", email: "associate@example.com", pass: "password123", badge: "Assigned Cases" },
  { name: "Roshni", role: "Paralegal Staff", email: "paralegal@example.com", pass: "password123", badge: "Support Staff" },
];

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(login, INITIAL);
  const [authMode, setAuthMode] = useState<"email" | "mobile">("email");
  const [showPassword, setShowPassword] = useState(false);
  const [emailOrMobile, setEmailOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showDemoModal, setShowDemoModal] = useState(false);

  const fillDemoCredentials = (email: string, pass: string) => {
    setEmailOrMobile(email);
    setPassword(pass);
    if (authMode !== "email") setAuthMode("email");
  };

  return (
    <div className="w-full">
      {/* Segmented Tab Switcher: Email vs Mobile */}
      <div className="mb-6 flex items-center rounded-2xl bg-sunken/90 p-1.5 text-sm font-medium border border-hairline/50">
        <button
          type="button"
          onClick={() => setAuthMode("email")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-serif font-semibold transition-all duration-200 ${
            authMode === "email"
              ? "bg-white text-[#0094d2] shadow-sm"
              : "text-secondary hover:text-primary"
          }`}
        >
          <Mail className={`h-4 w-4 ${authMode === "email" ? "text-[#0094d2]" : "text-muted"}`} />
          <span>Email</span>
        </button>

        <button
          type="button"
          onClick={() => setAuthMode("mobile")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-serif font-semibold transition-all duration-200 ${
            authMode === "mobile"
              ? "bg-white text-[#0094d2] shadow-sm"
              : "text-secondary hover:text-primary"
          }`}
        >
          <Smartphone className={`h-4 w-4 ${authMode === "mobile" ? "text-[#0094d2]" : "text-muted"}`} />
          <span>Mobile</span>
        </button>
      </div>

      <form action={formAction} className="space-y-5">
        {notice ? (
          <div
            role="status"
            className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning font-medium flex items-center gap-2"
          >
            <Shield className="h-4 w-4 text-warning shrink-0" />
            <span>{notice}</span>
          </div>
        ) : null}

        {/* Identifier Field (Email or Mobile) */}
        <div>
          <label htmlFor="email" className="mb-1.5 block font-serif text-sm font-bold text-primary">
            {authMode === "email" ? "Email Address" : "Mobile Number"}
          </label>
          <div className="relative flex items-center rounded-2xl border border-transparent bg-[#edf4ff] transition-all focus-within:border-[#00a8e8]/50 focus-within:bg-white focus-within:ring-4 focus-within:ring-[#00a8e8]/10">
            <div className="pointer-events-none pl-4 text-muted">
              {authMode === "email" ? (
                <Mail className="h-5 w-5 text-muted" />
              ) : (
                <Smartphone className="h-5 w-5 text-muted" />
              )}
            </div>
            <input
              id="email"
              name="email"
              type={authMode === "email" ? "email" : "text"}
              autoComplete={authMode === "email" ? "username" : "tel"}
              required
              disabled={pending}
              value={emailOrMobile}
              onChange={(e) => setEmailOrMobile(e.target.value)}
              className="w-full bg-transparent py-3.5 pl-3 pr-4 text-sm font-medium text-primary placeholder:text-muted focus:outline-none disabled:opacity-60"
              placeholder={authMode === "email" ? "shubham@pawarassociates.com" : "+91 98765 43210"}
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="mb-1.5 block font-serif text-sm font-bold text-primary">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent py-3.5 pl-3 pr-10 text-sm font-medium text-primary placeholder:text-muted focus:outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-3.5 text-muted hover:text-secondary focus:outline-none"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-muted" />
              ) : (
                <Eye className="h-5 w-5 text-muted" />
              )}
            </button>
          </div>
        </div>

        {state.error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger font-medium"
          >
            {state.error}
          </div>
        ) : null}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 w-full rounded-2xl bg-[#00a8e8] py-4 font-serif text-base font-bold text-white shadow-lg shadow-[#00a8e8]/25 transition-all duration-200 hover:bg-[#0096c7] hover:shadow-cyan-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {pending ? "Signing In…" : "Sign In to Dashboard"}
        </button>
      </form>

      {/* Quick Test Accounts Picker */}
      <div className="mt-6 border-t border-hairline pt-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted font-serif flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-[#0094d2]" />
            Test Staff Accounts
          </span>
          <button
            type="button"
            onClick={() => setShowDemoModal(!showDemoModal)}
            className="text-xs font-semibold text-[#0094d2] hover:underline flex items-center gap-1"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {showDemoModal ? "Hide Passwords" : "View Passwords"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => fillDemoCredentials(acc.email, acc.pass)}
              className="flex flex-col items-start rounded-xl border border-hairline/80 bg-sunken/80 p-2.5 text-left transition-all hover:border-[#00a8e8]/50 hover:bg-[#edf4ff] group"
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-bold text-primary group-hover:text-[#0094d2]">
                  {acc.name}
                </span>
                <span className="text-[9px] rounded bg-accent-50 px-1.5 py-0.5 font-bold text-accent-800">
                  {acc.role.split(" ")[0]}
                </span>
              </div>
              <span className="mt-0.5 text-[11px] text-muted truncate w-full">
                {acc.email}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
