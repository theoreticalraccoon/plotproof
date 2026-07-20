import { HttpAnalysisClient, type AnalysisClient } from "./client";
import { StubAnalysisClient } from "./stub";

export * from "./types";
export type { AnalysisClient } from "./client";

/**
 * Returns the analysis client the rest of the app should use.
 *
 * Uses the stub when ANALYSIS_STUB=1 or when no ANALYSIS_SERVICE_URL is set —
 * so the whole app runs end-to-end with zero external dependencies until the
 * real Python service exists. Set ANALYSIS_SERVICE_URL and ANALYSIS_STUB=0 to
 * switch over; no downstream code changes.
 */
export function getAnalysisClient(): AnalysisClient {
  const url = process.env.ANALYSIS_SERVICE_URL?.trim();
  const forceStub = process.env.ANALYSIS_STUB === "1";

  if (forceStub || !url) {
    return new StubAnalysisClient();
  }
  return new HttpAnalysisClient(url);
}
