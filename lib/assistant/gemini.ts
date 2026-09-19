/** Gemini REST client for the assistant: key pool, request shape, stream parsing. No network here. */

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Tried in order on each key. Each model has its own free-tier quota (3.8-flash allows only 20
// requests a day), so a busy model falls through to the next rather than failing the question.
export const MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"] as const;

/** GEMINI_API_KEYS is comma separated. Blank and duplicate entries are ignored. */
export function parseKeys(raw: string | undefined): string[] {
  return [...new Set((raw ?? "").split(/[,\s]+/).map((k) => k.trim()).filter(Boolean))];
}

/**
 * The order to try keys in for one request. A random start spreads load evenly across keys, and
 * keys cooling down after a 429 or a rejection go last rather than being dropped.
 */
export function keyOrder(n: number, rand: number, coolingUntil: Map<number, number>, now: number): number[] {
  const start = Math.floor(Math.max(0, Math.min(0.999999, rand)) * n);
  const all = Array.from({ length: n }, (_, i) => (start + i) % n);
  const ready = all.filter((i) => (coolingUntil.get(i) ?? 0) <= now);
  const cooling = all.filter((i) => (coolingUntil.get(i) ?? 0) > now);
  return [...ready, ...cooling];
}

export type UpstreamFailure = "busy" | "rejected" | "model_unavailable" | "error";

/** What an HTTP error from Gemini means for the next attempt. */
export function classifyStatus(status: number, body: string): UpstreamFailure {
  if (status === 429 || status === 503 || status === 500 || status === 502 || status === 504) return "busy";
  if (status === 404 || (status === 400 && /not supported for this model|model .* not found/i.test(body))) {
    return "model_unavailable";
  }
  if (status === 401 || status === 403 || (status === 400 && /api key|API_KEY|billing|permission/i.test(body))) {
    return "rejected";
  }
  return "error";
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

const SAFETY = ["HARASSMENT", "HATE_SPEECH", "SEXUALLY_EXPLICIT", "DANGEROUS_CONTENT"].map((c) => ({
  category: `HARM_CATEGORY_${c}`,
  threshold: "BLOCK_MEDIUM_AND_ABOVE",
}));

export function requestBody(system: string, turns: Turn[], maxOutputTokens: number) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
    safetySettings: SAFETY,
    generationConfig: {
      maxOutputTokens,
      temperature: 0.3,
      // Low thinking keeps answers fast and leaves the token budget for the answer itself.
      thinkingConfig: { thinkingLevel: "low" },
    },
  };
}

export function streamUrl(model: string): string {
  return `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse`;
}

export type Ending = "cut" | "refused" | null;

/** Visible text and ending from one SSE event. Thought parts are never shown. */
export function readEvent(json: unknown): { text: string; ending: Ending } {
  const e = json as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (e?.promptFeedback?.blockReason) return { text: "", ending: "refused" };
  const c = e?.candidates?.[0];
  const text = (c?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
  const fr = c?.finishReason;
  let ending: Ending = null;
  if (fr === "MAX_TOKENS") ending = "cut";
  else if (fr && fr !== "STOP" && fr !== "FINISH_REASON_UNSPECIFIED") ending = "refused";
  return { text, ending };
}

/** Splits an SSE byte stream into JSON events; keeps any partial line for the next chunk. */
export class SseParser {
  private buf = "";
  push(chunk: string): unknown[] {
    this.buf += chunk;
    const lines = this.buf.split(/\r?\n/);
    this.buf = lines.pop() ?? "";
    const out: unknown[] = [];
    for (const l of lines) {
      if (!l.startsWith("data:")) continue;
      const payload = l.slice(5).trim();
      if (!payload) continue;
      try {
        out.push(JSON.parse(payload));
      } catch {
        // A malformed event is skipped, never shown.
      }
    }
    return out;
  }
}
