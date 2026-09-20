/** POST /api/eudr/assess, zonal forest statistics for one plot boundary. */
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { assessPlot } from "@/lib/eudr/assess";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const sb = await createClient();
    const { data } = await sb.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  }

  const key = process.env.GFW_API_KEY;
  if (!key) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let ring: unknown;
  try {
    ring = (await request.json())?.ring;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await assessPlot(ring, { key, fetch });
  return result.ok
    ? NextResponse.json({ stats: result.stats, at: result.at })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
