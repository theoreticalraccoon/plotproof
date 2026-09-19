/** POST /api/eudr/assess, zonal forest statistics for one plot boundary. */
import { NextResponse } from "next/server";
import { computeAreaHa } from "@/lib/intake/geometry";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_PLOT_HA,
  checkRing,
  plotQueries,
  queryUrl,
  rowsOf,
  statsFromRows,
  type GfwQuery,
  type LngLat,
} from "@/lib/eudr/gfw";

export const runtime = "nodejs";

const TIMEOUT_MS = 25_000;

async function runQuery(q: GfwQuery, ring: LngLat[], key: string, signal: AbortSignal) {
  const res = await fetch(queryUrl(q), {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ sql: q.sql, geometry: { type: "Polygon", coordinates: [ring] } }),
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GFW ${q.dataset} ${res.status}: ${detail.slice(0, 200)}`);
  }
  return rowsOf(await res.json());
}

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

  const problem = checkRing(ring);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const coords = ring as LngLat[];

  const plotHa = computeAreaHa(coords);
  if (!(plotHa > 0)) return NextResponse.json({ error: "zero_area" }, { status: 400 });
  if (plotHa > MAX_PLOT_HA) return NextResponse.json({ error: "too_large" }, { status: 400 });

  const q = plotQueries();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const [forestTotal, lossOnForest, lossDrivers, plantation, hansen] = await Promise.all([
      runQuery(q.forestTotal, coords, key, controller.signal),
      runQuery(q.lossOnForest, coords, key, controller.signal),
      runQuery(q.lossDrivers, coords, key, controller.signal),
      runQuery(q.plantation, coords, key, controller.signal),
      runQuery(q.hansen, coords, key, controller.signal),
    ]);
    return NextResponse.json({
      stats: statsFromRows(plotHa, { forestTotal, lossOnForest, lossDrivers, plantation, hansen }),
      at: new Date().toISOString(),
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    console.error("[eudr/assess]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: aborted ? "timeout" : "upstream_failed" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
