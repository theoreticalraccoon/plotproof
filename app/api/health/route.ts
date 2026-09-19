// Liveness + warmup. Hitting this wakes a cold serverless function before the demo needs the
// analysis routes.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
