/**
 * Public, no-login GeoJSON of flagged clearing patches (de-identified) for the
 * open map. Cached briefly at the edge — this is read-heavy public data.
 */
import { NextResponse } from "next/server";
import { featureCollection } from "@/lib/public/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(featureCollection(), {
    headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
