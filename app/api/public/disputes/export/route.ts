/**
 * Open training-label export. Demonstrates the downstream use the dispute record
 * was designed for: each row is a ground-truth label tied to the satellite claim
 * it corrects. Free-text and photos are omitted here (PII / moderation); a
 * production export would serve reviewed labels with photos from Storage.
 *
 * ?format=ndjson streams one JSON label per line (friendly for ML pipelines).
 */
import { NextResponse } from "next/server";
import { toTrainingLabels } from "@/lib/public/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const labels = toTrainingLabels();
  const format = new URL(req.url).searchParams.get("format");

  if (format === "ndjson") {
    const body = labels.map((l) => JSON.stringify(l)).join("\n");
    return new NextResponse(body, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8" },
    });
  }
  return NextResponse.json({ count: labels.length, labels });
}
