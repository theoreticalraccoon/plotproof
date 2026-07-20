/**
 * Public dispute/confirmation submission — no login. Stored as a labelled
 * training sample (see lib/public/types.ts), not a support ticket.
 *
 * Abuse handling for a public endpoint (rate limiting, CAPTCHA, moderation) is a
 * production concern; here every submission lands as reviewStatus="unverified"
 * and is only trusted for training after curation.
 */
import { NextResponse } from "next/server";
import { addDispute, type NewDispute } from "@/lib/public/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Guard the inline demo photo size (compressed client-side to ~150–350 KB).
const MAX_PHOTO_CHARS = 1_500_000; // ~1.1 MB of base64

export async function POST(req: Request) {
  let body: NewDispute;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (body.stance !== "confirm" && body.stance !== "dispute") {
    return NextResponse.json({ error: "stance must be confirm or dispute" }, { status: 400 });
  }
  if (!Array.isArray(body.location) || body.location.length !== 2) {
    return NextResponse.json({ error: "location [lng,lat] is required" }, { status: 400 });
  }
  if (body.photo?.dataUrl && body.photo.dataUrl.length > MAX_PHOTO_CHARS) {
    return NextResponse.json({ error: "photo too large" }, { status: 413 });
  }

  const dispute = addDispute(body);
  return NextResponse.json(
    { ok: true, id: dispute.id, reviewStatus: dispute.reviewStatus },
    { status: 201 },
  );
}
