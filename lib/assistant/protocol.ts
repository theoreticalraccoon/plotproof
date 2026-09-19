/** The wire contract between the assistant route and the chat panel. */

// Appended to the streamed answer to report how it ended, then stripped by the client, which
// says so in the officer's language.
const NUL = String.fromCharCode(0);
export const END = {
  cut: NUL + "CUT",
  refused: NUL + "REFUSED",
  /** Transient: the answer stopped part-way and trying again may work. */
  failed: NUL + "FAILED",
  // Not transient: the deployment's API access is rejected outright, a bad key, a revoked key,
  // or an account with no credit.
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
