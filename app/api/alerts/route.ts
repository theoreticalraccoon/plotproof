/**
 * Alert list for the exporter's history view.
 */
import { NextResponse } from "next/server";
import { getMonitoringRepo } from "@/lib/monitoring/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const alerts = await getMonitoringRepo().listAlerts();
  return NextResponse.json({ alerts });
}
