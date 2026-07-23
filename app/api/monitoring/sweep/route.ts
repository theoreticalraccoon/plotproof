/**
 * Daily monitoring sweep. Wired to Vercel Cron (see vercel.json). Re-analyses
 * every plot that is due (weekly cadence) and alerts on new clearing.
 *
 * Protected by CRON_SECRET: Vercel Cron sends `Authorization: Bearer <secret>`.
 * Fails closed: with no CRON_SECRET set the route refuses to run except in a
 * non-production build, so a deployment can never expose an open trigger.
 */
import { NextResponse } from "next/server";
import { runMonitoringSweep } from "@/lib/monitoring/engine";
import { requireBearer } from "@/lib/routeAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const denied = requireBearer(req, "CRON_SECRET");
  if (denied) return denied;
  const summary = await runMonitoringSweep();
  return NextResponse.json({ ok: true, ...summary });
}
