/** POST /api/assistant: sign-in, per-account limits, then a streamed Gemini answer. */
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { checkTurns } from "@/lib/assistant/prompt";
import { parseKeys } from "@/lib/assistant/gemini";
import { KeyPool, answer } from "@/lib/assistant/answer";
import { memoryLedger, supabaseLedger, type UsageLedger } from "@/lib/assistant/ledger";
import { normalizeSale } from "@/lib/sale/model";
import type { Sale } from "@/lib/sale/types";

export const runtime = "nodejs";

// Per server instance.
const pool = new KeyPool();
// Only used when Supabase is not configured (local development), keyed by IP.
const devLedger = memoryLedger();

async function ledgerFor(request: Request): Promise<{ ledger: UsageLedger; account: string } | NextResponse> {
  if (!isSupabaseConfigured()) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    return { ledger: devLedger, account: ip };
  }
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  return { ledger: supabaseLedger(sb as unknown as Parameters<typeof supabaseLedger>[0]), account: auth.user.id };
}

export async function POST(request: Request) {
  const keys = parseKeys(process.env.GEMINI_API_KEYS);
  if (keys.length === 0) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { messages?: unknown; sale?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const checked = checkTurns(body.messages);
  if ("problem" in checked) return NextResponse.json({ error: checked.problem }, { status: 400 });

  const who = await ledgerFor(request);
  if (who instanceof NextResponse) return who;
  const outcome = await who.ledger.take(who.account);
  if (outcome === "rate_limited") return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (outcome === "limits_unavailable") return NextResponse.json({ error: "limits_unavailable" }, { status: 503 });

  // Re-derived here from the raw sale rather than trusting a summary the browser built.
  let sale: Sale | null = null;
  if (body.sale && typeof body.sale === "object" && typeof (body.sale as Sale).id === "string") {
    try {
      sale = normalizeSale(body.sale as Sale);
    } catch {
      sale = null;
    }
  }

  const result = await answer(checked.turns, sale, request.signal, { keys, fetch, pool });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return new Response(result.stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
