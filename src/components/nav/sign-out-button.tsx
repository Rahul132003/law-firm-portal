"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { signOutAction } from "@/lib/auth/actions";

export function SignOutButton({
  showLabel = true,
  className,
}: {
  showLabel?: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title="Sign out"
      aria-label={showLabel ? undefined : "Sign out"}
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
      className={
        className ??
        `flex items-center gap-1.5 rounded-md text-xs font-medium text-secondary transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-60 ${
          showLabel ? "px-1.5 py-1" : "p-2"
        }`
      }
    >
      <LogOut
        className={`size-4 shrink-0 ${pending ? "animate-pulse" : ""}`}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      {showLabel ? <span>{pending ? "Signing out…" : "Sign out"}</span> : null}
    </button>
  );
}
