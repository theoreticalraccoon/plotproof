/**
 * The acoustic exhibit for a plot location — the data the PDF exhibit section
 * renders. Query: ?lng=&lat=&radiusKm=&days=
 *
 * "Satellite says where (the plot), the acoustic nodes say when (these
 * timestamped detections nearby)."
 */
import { NextResponse } from "next/server";
import { plotExhibit } from "@/lib/acoustic/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const lng = Number(p.get("lng"));
  const lat = Number(p.get("lat"));
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return NextResponse.json({ error: "lng and lat are required" }, { status: 400 });
  }
  const radiusKm = Number(p.get("radiusKm")) || 3;
  const days = Number(p.get("days")) || 90;
  const since = new Date(Date.now() - days * 864e5).toISOString();

  return NextResponse.json(plotExhibit({ lng, lat }, { radiusKm, since }));
}
