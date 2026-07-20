/**
 * Recent acoustic events + node roster. For the preview page and debugging.
 */
import { NextResponse } from "next/server";
import { listEvents, listNodes } from "@/lib/acoustic/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 100);
  return NextResponse.json({
    nodes: listNodes(),
    events: listEvents(Number.isFinite(limit) ? limit : 100),
  });
}
