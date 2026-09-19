/** POST /api/assistant: the export assistant on Gemini, streamed, load split across the keys. */
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { END, LIMITS, SYSTEM_PROMPT, checkTurns, saleContext } from "@/lib/assistant/prompt";
import {
  MODELS,
  SseParser,
  classifyStatus,
  keyOrder,
  parseKeys,
  readEvent,
  requestBody,
  streamUrl,
  type Turn,
} from "@/lib/assistant/gemini";
import { normalizeSale } from "@/lib/sale/model";
import type { Sale } from "@/lib/sale/types";

export const runtime = "nodejs";

const CONNECT_TIMEOUT_MS = 30_000;
const ANSWER_TIMEOUT_MS = 90_000;
// Per server instance: a key/model pair that was busy, or a key that was rejected, is tried last.
const busyUntil = new Map<string, number>();
const rejectedUntil = new Map<number, number>();
const COOL_BUSY_MS = 60_000;
const COOL_REJECTED_MS = 10 * 60_000;

// Only used when Supabase is not configured (local development).
const devHits = new Map<string, number[]>();
function devLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (devHits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= LIMITS.perHour || recent.filter((t) => now - t < 60_000).length >= LIMITS.perMinute) return true;
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
    // Most likely migration 0004 has not been applied. Refuse rather than run unmetered.
    console.error("[assistant] usage ledger unavailable:", error.message);
    return NextResponse.json({ error: "limits_unavailable" }, { status: 503 });
  }

  const now = Date.now();
  const times = (rows ?? []).map((r) => new Date(r.created_at as string).getTime());
  const lastMinute = times.filter((t) => now - t < 60_000).length;
  const lastHour = times.filter((t) => now - t < 3_600_000).length;
  if (lastMinute >= LIMITS.perMinute || lastHour >= LIMITS.perHour || times.length >= LIMITS.perDay) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Recorded before the model is called, so an abandoned answer still counts.
  const { error: insertError } = await sb.from("chat_usage").insert({ user_id: auth.user.id });
  if (insertError) {
    console.error("[assistant] could not record usage:", insertError.message);
    return NextResponse.json({ error: "limits_unavailable" }, { status: 503 });
  }
  return null;
}

/**
 * First key/model pair that accepts the request; nothing is streamed until one does. Every pair
 * is tried before giving up, since each model has its own quota on each key.
 */
async function openUpstream(keys: string[], body: string, signal: AbortSignal) {
  const failures: string[] = [];
  const now = Date.now();
  const pairs = keyOrder(keys.length, Math.random(), rejectedUntil, now).flatMap((k) =>
    MODELS.map((model) => ({ k, model, id: `${k}:${model}` })),
  );
  // Pairs cooling down after a 429 or 503 go to the back of the queue.
  pairs.sort((a, b) => Number((busyUntil.get(a.id) ?? 0) > now) - Number((busyUntil.get(b.id) ?? 0) > now));
  const deadKeys = new Set<number>();
  for (const { k, model, id } of pairs) {
    if (deadKeys.has(k)) continue;
    let res: Response;
    try {
      res = await fetch(streamUrl(model), {
        method: "POST",
        headers: { "x-goog-api-key": keys[k], "Content-Type": "application/json" },
        body,
        signal,
      });
    } catch (e) {
      if (signal.aborted) throw e;
      failures.push("busy");
      continue;
    }
    if (res.ok && res.body) return { res, failures };
    const kind = classifyStatus(res.status, await res.text().catch(() => ""));
    console.error(`[assistant] key ${k + 1} ${model}: ${res.status} ${kind}`);
    failures.push(kind);
    if (kind === "busy") busyUntil.set(id, now + COOL_BUSY_MS);
    if (kind === "rejected") {
      rejectedUntil.set(k, now + COOL_REJECTED_MS);
      deadKeys.add(k);
    }
  }
  return { res: null, failures };
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

  const blocked = await enforceLimit(request);
  if (blocked) return blocked;

  // Re-derived here from the raw sale rather than trusting a summary the browser built.
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
  const payload: Turn[] = [
    ...turns.slice(0, -1),
    { role: "user", content: context ? `${context}\n\n${last.content}` : last.content },
  ];

  // Stops generation if the officer leaves, and gives up on an upstream that hangs.
  const upstream = new AbortController();
  let timer = setTimeout(() => upstream.abort(), CONNECT_TIMEOUT_MS);
  request.signal.addEventListener("abort", () => upstream.abort());

  let opened;
  try {
    opened = await openUpstream(keys, JSON.stringify(requestBody(SYSTEM_PROMPT, payload, LIMITS.maxOutputTokens)), upstream.signal);
  } catch {
    clearTimeout(timer);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
  if (!opened.res) {
    clearTimeout(timer);
    const allRejected = opened.failures.length > 0 && opened.failures.every((f) => f === "rejected" || f === "model_unavailable");
    return allRejected
      ? NextResponse.json({ error: "not_configured" }, { status: 503 })
      : NextResponse.json({ error: "busy" }, { status: 503 });
  }

  clearTimeout(timer);
  timer = setTimeout(() => upstream.abort(), ANSWER_TIMEOUT_MS);
  const reader = opened.res.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const parser = new SseParser();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let ending: "cut" | "refused" | null = null;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          for (const ev of parser.push(decoder.decode(value, { stream: true }))) {
            const r = readEvent(ev);
            if (r.text) controller.enqueue(encoder.encode(r.text));
            if (r.ending) ending = r.ending;
          }
        }
        if (ending === "cut") controller.enqueue(encoder.encode(END.cut));
        if (ending === "refused") controller.enqueue(encoder.encode(END.refused));
      } catch (e) {
        if (!request.signal.aborted) {
          console.error("[assistant] stream broke:", e instanceof Error ? e.message : e);
          controller.enqueue(encoder.encode(END.failed));
        }
      } finally {
        clearTimeout(timer);
        controller.close();
      }
    },
    cancel() {
      upstream.abort();
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
