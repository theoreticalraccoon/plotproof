/** Answers one assistant question on Gemini: builds the request, fails over across keys and models, relays the stream. */
import { END, LIMITS, type Ending } from "./protocol.ts";
import { SYSTEM_PROMPT, saleContext, type ChatTurn } from "./prompt.ts";
import { MODELS, SseParser, classifyStatus, keyOrder, readEvent, requestBody, streamUrl, type UpstreamFailure } from "./gemini.ts";
import type { Sale } from "../sale/types";

const COOL_BUSY_MS = 60_000;
const COOL_REJECTED_MS = 10 * 60_000;

/** Which keys and models recently failed. One per server instance; tests make their own. */
export class KeyPool {
  readonly busyUntil = new Map<string, number>();
  readonly rejectedUntil = new Map<number, number>();
}

export interface AnswerDeps {
  keys: string[];
  fetch: typeof fetch;
  pool: KeyPool;
  now?: () => number;
  random?: () => number;
  connectTimeoutMs?: number;
  answerTimeoutMs?: number;
}

export type AnswerResult =
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; error: "busy" | "not_configured" | "failed"; status: number };

/** The question with the sale's context in front of it, as data rather than instructions. */
export function buildTurns(turns: ChatTurn[], sale: Sale | null): ChatTurn[] {
  let context = "";
  if (sale) {
    try {
      context = saleContext(sale);
    } catch {
      context = "";
    }
  }
  const last = turns[turns.length - 1];
  return [...turns.slice(0, -1), { role: "user", content: context ? `${context}\n\n${last.content}` : last.content }];
}

/** First key and model pair that accepts the request. Every pair is tried before giving up. */
async function openUpstream(body: string, signal: AbortSignal, deps: AnswerDeps) {
  const { keys, pool } = deps;
  const now = deps.now?.() ?? Date.now();
  const failures: UpstreamFailure[] = [];
  const pairs = keyOrder(keys.length, deps.random?.() ?? Math.random(), pool.rejectedUntil, now).flatMap((k) =>
    MODELS.map((model) => ({ k, model, id: `${k}:${model}` })),
  );
  // Pairs cooling down after a 429 or 503 go to the back of the queue.
  const cooling = (id: string) => Number((pool.busyUntil.get(id) ?? 0) > now);
  pairs.sort((a, b) => cooling(a.id) - cooling(b.id));
  const deadKeys = new Set<number>();
  for (const { k, model, id } of pairs) {
    if (deadKeys.has(k)) continue;
    let res: Response;
    try {
      res = await deps.fetch(streamUrl(model), {
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
    if (kind === "busy") pool.busyUntil.set(id, now + COOL_BUSY_MS);
    if (kind === "rejected") {
      pool.rejectedUntil.set(k, now + COOL_REJECTED_MS);
      deadKeys.add(k);
    }
  }
  return { res: null, failures };
}

/** Gemini's SSE turned into plain text, with an end marker when the answer did not finish normally. */
function relay(res: Response, upstream: AbortController, clientSignal: AbortSignal, timer: { id: ReturnType<typeof setTimeout> }) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const parser = new SseParser();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let ending: Ending | null = null;
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
      } catch (e) {
        if (!clientSignal.aborted) {
          console.error("[assistant] stream broke:", e instanceof Error ? e.message : e);
          ending = "failed";
        }
      } finally {
        clearTimeout(timer.id);
        if (ending && !clientSignal.aborted) controller.enqueue(encoder.encode(END[ending]));
        controller.close();
      }
    },
    cancel() {
      upstream.abort();
    },
  });
}

/** Opens an answer. Nothing is streamed until an upstream pair has accepted the request. */
export async function answer(turns: ChatTurn[], sale: Sale | null, clientSignal: AbortSignal, deps: AnswerDeps): Promise<AnswerResult> {
  if (deps.keys.length === 0) return { ok: false, error: "not_configured", status: 503 };

  // Stops generation if the officer leaves, and gives up on an upstream that hangs.
  const upstream = new AbortController();
  const timer = { id: setTimeout(() => upstream.abort(), deps.connectTimeoutMs ?? 30_000) };
  clientSignal.addEventListener("abort", () => upstream.abort());

  const body = JSON.stringify(requestBody(SYSTEM_PROMPT, buildTurns(turns, sale), LIMITS.maxOutputTokens));
  let opened;
  try {
    opened = await openUpstream(body, upstream.signal, deps);
  } catch {
    clearTimeout(timer.id);
    return { ok: false, error: "failed", status: 502 };
  }
  clearTimeout(timer.id);
  if (!opened.res) {
    const allRejected =
      opened.failures.length > 0 && opened.failures.every((f) => f === "rejected" || f === "model_unavailable");
    return { ok: false, error: allRejected ? "not_configured" : "busy", status: 503 };
  }

  timer.id = setTimeout(() => upstream.abort(), deps.answerTimeoutMs ?? 90_000);
  return { ok: true, stream: relay(opened.res, upstream, clientSignal, timer) };
}
