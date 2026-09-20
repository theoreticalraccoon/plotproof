/** The browser side of the assistant: sends a question and streams the answer back as it arrives. */
import { decodeAnswer, type Ending } from "./protocol.ts";

export type AskResult =
  | { ok: true; text: string; ending: Ending | null }
  | { ok: false; error: string };

export async function ask(
  payload: { messages: { role: string; content: string }[]; sale: unknown },
  onText: (visible: string) => void,
  signal: AbortSignal,
  doFetch: typeof fetch = fetch,
): Promise<AskResult> {
  let res: Response;
  try {
    res = await doFetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch {
    return { ok: false, error: signal.aborted ? "aborted" : "offline" };
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? "failed" };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      onText(decodeAnswer(text).visible);
    }
  } catch {
    if (signal.aborted) return { ok: false, error: "aborted" };
    const { visible } = decodeAnswer(text);
    return { ok: true, text: visible, ending: "failed" };
  }
  const { visible, ending } = decodeAnswer(text);
  return { ok: true, text: visible, ending };
}
