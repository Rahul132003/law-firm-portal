import { NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron/auth";
import { runHearingReminderSweep } from "@/lib/hearings/reminders";

/**
 * Scheduled hearing reminder sweep. Safe to call repeatedly — the sweep is
 * idempotent, so a retry or an overlapping run sends nothing twice.
 */
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const result = await runHearingReminderSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Hearing reminder sweep failed", error);
    return NextResponse.json(
      { ok: false, error: "Sweep failed." },
      { status: 500 },
    );
  }
}

// GET for Vercel Cron, POST for schedulers that insist on it.
export const GET = handle;
export const POST = handle;
