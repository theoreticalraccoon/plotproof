/**
 * Acoustic ingest webhook. A LoRa gateway / network server (TTN, ChirpStack)
 * decodes an ESP32 uplink and POSTs it here. One decoded detection per call.
 *
 * Auth: shared bearer token (ACOUSTIC_INGEST_TOKEN), the same pattern TTN
 * webhooks use. Fails closed in production when the token is unset.
 * Idempotent on (devEui, fCnt).
 */
import { NextResponse } from "next/server";
import { ingest } from "@/lib/acoustic/store";
import type { IngestUplink } from "@/lib/acoustic/types";
import { requireBearer } from "@/lib/routeAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = requireBearer(req, "ACOUSTIC_INGEST_TOKEN");
  if (denied) return denied;
  let uplink: IngestUplink;
  try {
    uplink = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const result = ingest(uplink);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
}
