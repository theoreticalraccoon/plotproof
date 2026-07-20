/**
 * Daily monitoring sweep. Wired to Vercel Cron (see vercel.json). Re-analyses
 * every plot that is due (weekly cadence) and alerts on new clearing.
 *
 * Protected by CRON_SECRET: Vercel Cron sends `Authorization: Bearer <secret>`.
 * When CRON_SECRET is unset (local dev), the route runs unauthenticated so the
 * alert history is demoable.
 */
import { NextResponse } from "next/server";
import { runMonitoringSweep } from "@/lib/monitoring/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runMonitoringSweep();
  return NextResponse.json({ ok: true, ...summary });
}
