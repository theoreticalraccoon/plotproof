/** The wire contract between the assistant route and the chat panel: both sides encode and decode here. */

// Appended to the streamed answer to report how it ended, then stripped by the client, which
// says so in the officer's language.
const NUL = String.fromCharCode(0);
export type Ending = "cut" | "refused" | "failed";
export const END: Record<Ending, string> = {
  cut: NUL + "CUT",
  refused: NUL + "REFUSED",
  /** Transient: the answer stopped part-way and trying again may work. */
  failed: NUL + "FAILED",
};

export const LIMITS = {
  /** Earlier turns sent back with each request. */
  maxTurns: 12,
  maxMessageChars: 2000,
  maxTotalChars: 14_000,
  /** Per account. */
  perMinute: 5,
  perHour: 20,
  perDay: 80,
  /** Answers are meant to be short; this caps cost as well as length. */
  maxOutputTokens: 2048,
} as const;

/** Splits streamed text into what the officer sees and how the answer ended. Works mid-stream too. */
export function decodeAnswer(text: string): { visible: string; ending: Ending | null } {
  const cut = text.indexOf(NUL);
  if (cut === -1) return { visible: text, ending: null };
  const marker = text.slice(cut);
  const ending = (Object.keys(END) as Ending[]).find((k) => END[k] === marker) ?? null;
  return { visible: text.slice(0, cut), ending };
}

/** Whether a request may go ahead, given this account's earlier request times. */
export function limitDecision(times: readonly number[], now: number): "ok" | "rate_limited" {
  const lastMinute = times.filter((t) => now - t < 60_000).length;
  const lastHour = times.filter((t) => now - t < 3_600_000).length;
  const lastDay = times.filter((t) => now - t < 86_400_000).length;
  return lastMinute >= LIMITS.perMinute || lastHour >= LIMITS.perHour || lastDay >= LIMITS.perDay
    ? "rate_limited"
    : "ok";
}
