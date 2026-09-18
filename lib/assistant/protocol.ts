/**
 * The wire contract between the assistant route and the chat panel.
 *
 * Kept apart from `prompt.ts` so the browser bundle carries these few constants
 * and not the system prompt and document catalog.
 */

/**
 * Appended to the streamed answer to report how it ended, then stripped by the
 * client, which says so in the officer's language. Without it a truncated or
 * failed answer is indistinguishable from a complete one. Prefixed with a NUL
 * character, which cannot appear in the model's text.
 */
const NUL = String.fromCharCode(0);
export const END = { cut: NUL + "CUT", refused: NUL + "REFUSED", failed: NUL + "FAILED" } as const;

export const LIMITS = {
  /** Earlier turns sent back with each request. */
  maxTurns: 12,
  maxMessageChars: 2000,
  maxTotalChars: 14_000,
  /** Per account. */
  perHour: 20,
  perDay: 80,
  /** Answers are meant to be short; this caps cost as well as length. */
  maxOutputTokens: 1024,
} as const;
