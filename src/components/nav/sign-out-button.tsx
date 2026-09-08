"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";

export function SignOutButton({ showLabel = true, className }: { showLabel?: boolean; className?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title="Sign out of chamber"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
      className={
        className ??
        "flex items-center gap-1.5 rounded-xl p-2 text-xs font-semibold text-slate-500 transition-all hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
      }
    >
      <LogOut className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${pending ? "animate-pulse" : ""}`} />
      {showLabel && (
        <span className="font-medium">
          {pending ? "Signing out…" : "Sign out"}
        </span>
      )}
    </button>
  );
}
