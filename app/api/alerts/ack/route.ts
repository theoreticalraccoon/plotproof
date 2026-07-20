/**
 * Acknowledge an alert. Records who acted and when — the evidence an exporter
 * needs to show they responded (PROJECT.md). Acknowledgement never deletes the
 * alert; it annotates it.
 */
import { NextResponse } from "next/server";
import { getMonitoringRepo } from "@/lib/monitoring/repo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { alertId?: string; acknowledgedBy?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { alertId, acknowledgedBy, note } = body;
  if (!alertId || !acknowledgedBy) {
    return NextResponse.json(
      { error: "alertId and acknowledgedBy are required" },
      { status: 400 },
    );
  }

  const repo = getMonitoringRepo();
  const alert = await repo.getAlert(alertId);
  if (!alert) {
    return NextResponse.json({ error: "alert not found" }, { status: 404 });
  }
  alert.acknowledgement = {
    acknowledgedBy,
    acknowledgedAt: new Date().toISOString(),
    note: note?.trim() || undefined,
  };
  await repo.updateAlert(alert);
  return NextResponse.json({ ok: true, alert });
}
