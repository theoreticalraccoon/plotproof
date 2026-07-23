/**
 * Shared bearer-token gate for machine-facing routes (cron, webhooks).
 *
 * Fails closed: if the expected env var is unset in a production build the
 * route returns 503 rather than running open. Only a non-production build
 * (local dev) may skip auth, and only when the secret is genuinely unset.
 */
import { NextResponse } from "next/server";

export function requireBearer(
  req: Request,
  envVar: "CRON_SECRET" | "ACOUSTIC_INGEST_TOKEN",
): NextResponse | null {
  const secret = process.env[envVar]?.trim();
  if (!secret) {
    if (process.env.NODE_ENV !== "production") return null; // local dev only
    return NextResponse.json(
      { error: "route_disabled", detail: `${envVar} is not configured; this endpoint is disabled.` },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
