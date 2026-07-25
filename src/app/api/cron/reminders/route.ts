import { NextResponse, type NextRequest } from "next/server";
import { dispatchDueReminders, scheduleDueTaskReminders } from "@/lib/messaging/reminders";

/**
 * Reminder cron.
 *
 * Two jobs in one pass: queue nudges for tomorrow's deadlines, then deliver
 * anything that has come due. Runs on a schedule from vercel.json.
 *
 * Guarded by CRON_SECRET — Vercel Cron sends it as a bearer token, and it can
 * also be passed as ?secret= for a manual run.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  if (auth !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scheduled = await scheduleDueTaskReminders();
    const dispatched = await dispatchDueReminders();

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      scheduled,
      dispatched,
    });
  } catch (error) {
    console.error("[cron:reminders]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
