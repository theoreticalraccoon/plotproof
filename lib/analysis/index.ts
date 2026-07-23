import { HttpAnalysisClient, type AnalysisClient } from "./client";
import { StubAnalysisClient } from "./stub";

export * from "./types";
export type { AnalysisClient } from "./client";

/**
 * Returns the analysis client the rest of the app should use, or null when no
 * real analysis is possible.
 *
 * There is deliberately NO silent fallback to the stub. A fabricated verdict
 * presented as real is worse than no verdict: it invites someone to attach a
 * coin flip to a document with legal weight. The stub exists for local
 * development and tests only, must be asked for explicitly (ANALYSIS_STUB=1),
 * and refuses to run in a production build. Callers must treat null as
 * "analysis unavailable" and say so on screen, never invent a number.
 */
export function getAnalysisClient(): AnalysisClient | null {
  const url = process.env.ANALYSIS_SERVICE_URL?.trim();
  const stubRequested = process.env.ANALYSIS_STUB === "1";

  if (url && !stubRequested) return new HttpAnalysisClient(url);
  if (stubRequested && process.env.NODE_ENV !== "production") {
    return new StubAnalysisClient();
  }
  return null;
}
