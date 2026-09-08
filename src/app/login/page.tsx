import type { Metadata } from "next";
import { FIRM_NAME } from "@/lib/firm";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: `Sign in · ${FIRM_NAME}`,
};

const NOTICES: Record<string, string> = {
  "account-inactive":
    "That account has been deactivated. Contact a partner if this is unexpected.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const { reason } = await props.searchParams;
  const notice = typeof reason === "string" ? NOTICES[reason] : undefined;

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#f8fafc] px-4 py-12">
      {/* Decorative Background Grid / Subtle Vector Lines */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <defs>
            <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
            </pattern>
            <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00b4d8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0077b6" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          {/* Elegant curved background vectors */}
          <path d="M-100,-100 Q 400,600 1200,-100" fill="none" stroke="url(#gradient-line)" strokeWidth="1.5" />
          <path d="M-100,800 Q 600,100 1400,800" fill="none" stroke="url(#gradient-line)" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Main Login Card Container */}
      <div className="relative z-10 w-full max-w-md rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_20px_60px_-15px_rgba(0,148,210,0.12)] sm:p-10">
        {/* Header with Law Firm Emblem */}
        <div className="mb-7 text-center">
          {/* Scales of Justice & Law Pillar Emblem */}
          <div className="mx-auto mb-4 flex h-20 w-24 items-center justify-center">
            <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-md">
              <defs>
                <linearGradient id="law-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00b4d8" />
                  <stop offset="100%" stopColor="#0077b6" />
                </linearGradient>
                <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f72585" />
                  <stop offset="100%" stopColor="#7209b7" />
                </linearGradient>
              </defs>
              {/* Outer Ring */}
              <circle cx="50" cy="50" r="44" fill="none" stroke="url(#law-gradient)" strokeWidth="3" opacity="0.2" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="url(#law-gradient)" strokeWidth="1.5" strokeDasharray="4 2" />
              
              {/* Pillar Base & Pedestal */}
              <rect x="24" y="80" width="52" height="6" rx="2" fill="url(#law-gradient)" />
              <rect x="30" y="74" width="40" height="4" rx="1" fill="url(#law-gradient)" opacity="0.8" />
              
              {/* Center Pillar */}
              <rect x="47" y="24" width="6" height="48" rx="2" fill="url(#law-gradient)" />
              
              {/* Scales Beam */}
              <path d="M 20 34 L 80 34" stroke="url(#law-gradient)" strokeWidth="4" strokeLinecap="round" />
              <circle cx="50" cy="24" r="5" fill="url(#law-gradient)" />
              
              {/* Left Scale Pan & Strings */}
              <path d="M 22 34 L 14 54 M 22 34 L 30 54" stroke="url(#law-gradient)" strokeWidth="1.5" opacity="0.7" />
              <path d="M 10 54 Q 22 62 34 54 Z" fill="url(#law-gradient)" />
              
              {/* Right Scale Pan & Strings */}
              <path d="M 78 34 L 70 54 M 78 34 L 86 54" stroke="url(#law-gradient)" strokeWidth="1.5" opacity="0.7" />
              <path d="M 66 54 Q 78 62 90 54 Z" fill="url(#law-gradient)" />
            </svg>
          </div>

          {/* Title: LAW FIRM PORTAL */}
          <h1 className="font-serif text-2xl font-black uppercase tracking-tight text-slate-900 sm:text-3xl">
            LAW FIRM <span className="text-[#0094d2]">PORTAL</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-1 text-sm font-medium text-slate-500">
            Log in to your workspace ({FIRM_NAME})
          </p>
        </div>

        {/* Login Form */}
        <LoginForm notice={notice} />

        {/* Footer Note */}
        <p className="mt-6 text-center text-xs text-slate-400 font-serif">
          {FIRM_NAME} • Internal Legal Case Management
        </p>
      </div>
    </main>
  );
}
