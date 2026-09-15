import { NextResponse } from "next/server";
import { pruneLoginThrottle } from "@/lib/auth/throttle";
import { isCronAuthorised } from "@/lib/cron/auth";
import { runTaskDeadlineSweep } from "@/lib/tasks/alerts";

/**
 * Scheduled deadline alert sweep. Idempotent, so retries and overlapping runs
 * are harmless.
 */
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const result = await runTaskDeadlineSweep();

    // Piggybacks on the daily schedule; failing it must not fail the sweep.
    const throttleRowsPruned = await pruneLoginThrottle().catch((error) => {
      console.error("Login throttle pruning failed", error);
      return 0;
    });

    return NextResponse.json({ ok: true, ...result, throttleRowsPruned });
  } catch (error) {
    console.error("Task deadline sweep failed", error);
    return NextResponse.json(
      { ok: false, error: "Sweep failed." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
