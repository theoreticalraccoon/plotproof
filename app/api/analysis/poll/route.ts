/** Poll an analysis job. Returns queued/running, the result, or a failure. */
import { NextResponse } from "next/server";
import { getAnalysisClient } from "@/lib/analysis";

export const dynamic = "force-dynamic";

/**
 * The real analysis service returns tile URLs relative to ITS host
 * (`/tiles/<job>/<role>.png`). The browser can only load them if they are
 * absolute, so rewrite them against ANALYSIS_SERVICE_URL here, the one place
 * both halves are known. Stub URLs (`/stub/...`) are left as-is; the pack page
 * shows a labelled placeholder for those.
 */
function absolutiseTiles<T extends { status: string }>(poll: T): T {
  const base = process.env.ANALYSIS_SERVICE_URL?.trim()?.replace(/\/$/, "");
  if (!base || poll.status !== "succeeded") return poll;
  const p = poll as T & { result?: { imagery?: { url: string }[] } };
  for (const tile of p.result?.imagery ?? []) {
    if (tile.url.startsWith("/tiles/")) tile.url = `${base}${tile.url}`;
  }
  return poll;
}

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }
  const client = getAnalysisClient();
  if (!client) {
    return NextResponse.json({ error: "analysis_unavailable" }, { status: 503 });
  }
  const poll = await client.poll(jobId);
  return NextResponse.json(absolutiseTiles(poll));
}
