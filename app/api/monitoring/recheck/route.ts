/**
 * Pre-shipment recheck. Forces one plot to be re-analysed NOW against the newest
 * available pass, ignoring the weekly cadence. This is the "before the container
 * leaves" gate: a shipment workflow calls this and blocks on a fresh clear
 * result (D-010).
 */
import { NextResponse } from "next/server";
import { recheckPlot } from "@/lib/monitoring/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let plotId: string | undefined;
  try {
    ({ plotId } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!plotId) {
    return NextResponse.json({ error: "plotId is required" }, { status: 400 });
  }
  try {
    const result = await recheckPlot(plotId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "recheck failed" },
      { status: 404 },
    );
  }
}
