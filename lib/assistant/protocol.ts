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
export const END = {
  cut: NUL + "CUT",
  refused: NUL + "REFUSED",
  /** Transient: the answer stopped part-way and trying again may work. */
  failed: NUL + "FAILED",
  /**
   * Not transient: the deployment's API access is rejected outright — a bad key,
   * a revoked key, or an account with no credit. Kept apart from `failed`
   * because telling an officer to try again when nothing they do can help is
   * just a slower way of not answering.
   */
  unavailable: NUL + "UNAVAILABLE",
} as const;

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
