/**
 * Acoustic ingest webhook. A LoRa gateway / network server (TTN, ChirpStack)
 * decodes an ESP32 uplink and POSTs it here. One decoded detection per call.
 *
 * Auth: shared bearer token (ACOUSTIC_INGEST_TOKEN), the same pattern TTN
 * webhooks use. Unset → open (local dev only). Idempotent on (devEui, fCnt).
 */
import { NextResponse } from "next/server";
import { ingest } from "@/lib/acoustic/store";
import type { IngestUplink } from "@/lib/acoustic/types";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const token = process.env.ACOUSTIC_INGEST_TOKEN;
  if (!token) return true; // dev
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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
