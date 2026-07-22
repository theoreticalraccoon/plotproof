/**
 * Submit a plot for analysis. Thin wrapper over the analysis client (stub until
 * the Python service exists). Returns a job handle immediately, analysis is a
 * queued job, so the client polls.
 */
import { NextResponse } from "next/server";
import { getAnalysisClient, type AnalysisRequest } from "@/lib/analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: AnalysisRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body?.plotId || !body?.geometry) {
    return NextResponse.json({ error: "plotId and geometry are required" }, { status: 400 });
  }
  const handle = await getAnalysisClient().submit(body);
  return NextResponse.json(handle, { status: 202 });
}
