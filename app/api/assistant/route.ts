/**
 * POST /api/assistant — the export assistant, streamed.
 *
 * Claude Haiku 4.5, grounded in the sourced document catalog and a summary of
 * the officer's open consignment. The API key lives only here.
 *
 * Guardrails, in the order a request meets them:
 *   1. Signed-in officers only (when accounts are configured).
 *   2. A per-account rate limit, counted in Supabase from a ledger row written
 *      BEFORE the model is called — an abandoned answer still counts, and the
 *      client cannot delete or back-date its own rows. If the ledger cannot be
 *      read the route refuses: an unmetered model endpoint is the failure that
 *      costs money, so it fails closed.
 *   3. The conversation is validated: roles checked, oversized messages refused
 *      rather than silently cut, only recent turns kept.
 *   4. A fixed system prompt with the scope rules and the catalog; officer text
 *      arrives only in the user turn, inside a tag the rules call data.
 *   5. A short output cap, and generation stops if the officer navigates away.
 *
 * The response is plain text streamed as it is written. A trailing control
 * marker tells the client how the answer ended (cut off, refused, failed) so it
 * can say so in the officer's language rather than leave a half-answer looking
 * complete.
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { END, LIMITS, SYSTEM_PROMPT, checkTurns, saleContext } from "@/lib/assistant/prompt";
import { normalizeSale } from "@/lib/sale/model";
import type { Sale } from "@/lib/sale/types";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5";

// --- fallback limiter for a deployment with no accounts ---------------------------
// Only used when Supabase is not configured (local development). Per-instance
// memory, so it is a courtesy, not a control; a real deployment has accounts.
const devHits = new Map<string, number[]>();
function devLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (devHits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= LIMITS.perHour) return true;
  devHits.set(ip, [...recent, now]);
  return false;
}

async function enforceLimit(request: Request): Promise<NextResponse | null> {
  if (!isSupabaseConfigured()) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    return devLimited(ip) ? NextResponse.json({ error: "rate_limited" }, { status: 429 }) : null;
  }

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { data: rows, error } = await sb
    .from("chat_usage")
    .select("created_at")
    .eq("user_id", auth.user.id)
    .gte("created_at", dayAgo);
  if (error) {
    // Most likely migration 0004 has not been applied. Refuse rather than run
    // unmetered.
    console.error("[assistant] usage ledger unavailable:", error.message);
    return NextResponse.json({ error: "limits_unavailable" }, { status: 503 });
  }

  const hourAgo = Date.now() - 3_600_000;
  const lastHour = (rows ?? []).filter((r) => new Date(r.created_at as string).getTime() > hourAgo).length;
  if (lastHour >= LIMITS.perHour || (rows ?? []).length >= LIMITS.perDay) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { error: insertError } = await sb.from("chat_usage").insert({ user_id: auth.user.id });
  if (insertError) {
    console.error("[assistant] could not record usage:", insertError.message);
    return NextResponse.json({ error: "limits_unavailable" }, { status: 503 });
  }
  return null;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: { messages?: unknown; sale?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const checked = checkTurns(body.messages);
  if ("problem" in checked) return NextResponse.json({ error: checked.problem }, { status: 400 });

  const blocked = await enforceLimit(request);
  if (blocked) return blocked;

  // The sale is the officer's own data. It is re-derived here with the same
  // functions the page uses rather than trusting any summary the browser built.
  let context = "";
  if (body.sale && typeof body.sale === "object" && typeof (body.sale as Sale).id === "string") {
    try {
      context = saleContext(normalizeSale(body.sale as Sale));
    } catch {
      context = "";
    }
  }

  const turns = checked.turns;
  const last = turns[turns.length - 1];
  const messages: Anthropic.MessageParam[] = [
    ...turns.slice(0, -1).map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: context ? `${context}\n\n${last.content}` : last.content },
  ];

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const run = client.messages.stream(
          {
            model: MODEL,
            max_tokens: LIMITS.maxOutputTokens,
            // Fixed on every request, so it is cached across officers.
            system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            messages,
          },
          // Stop generating (and paying) if the officer leaves the page.
          { signal: request.signal },
        );
        for await (const event of run) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await run.finalMessage();
        if (final.stop_reason === "max_tokens") controller.enqueue(encoder.encode(END.cut));
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode(END.refused));
      } catch (e) {
        if (!request.signal.aborted) {
          if (e instanceof Anthropic.RateLimitError) console.error("[assistant] upstream rate limit");
          else if (e instanceof Anthropic.APIError) console.error(`[assistant] API ${e.status}: ${e.message}`);
          else console.error("[assistant]", e instanceof Error ? e.message : e);
          controller.enqueue(encoder.encode(END.failed));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
