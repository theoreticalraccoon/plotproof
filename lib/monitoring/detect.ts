/**
 * Monitoring decision logic. Pure functions, type-only imports (so this runs
 * under Node's --experimental-strip-types for tests). Two questions:
 *   1. is this plot DUE for re-analysis?          -> isDue
 *   2. does the latest result show NEW clearing?  -> detectNewClearing
 *
 * Change detection itself lives in the analysis service; monitoring only asks
 * "has something changed since we last told the exporter?".
 */
import type { AnalysisResult } from "@/lib/analysis";
import type { Subscription } from "./types";

/** Default per-plot cadence: weekly, matching new-imagery arrival (D-010). */
export const DEFAULT_CADENCE_DAYS = 7;

const DAY_MS = 86_400_000;

/** True if this subscription should be re-analysed now. */
export function isDue(sub: Subscription, nowMs: number): boolean {
  if (!sub.active) return false;
  if (!sub.lastCheckedAt) return true; // never checked
  const elapsed = nowMs - Date.parse(sub.lastCheckedAt);
  return elapsed >= sub.cadenceDays * DAY_MS;
}

export interface Detection {
  fires: boolean;
  reason?: string;
  clearingWindow?: { earliest: string; latest: string };
}

/**
 * Fire only on clearing we haven't already reported:
 *  - plot was clear, now flagged                    -> new clearing
 *  - plot was already flagged, but with a LATER      -> additional clearing
 *    clearing window than the one we last alerted on
 * Same window as last time -> no re-fire (no alert fatigue).
 */
export function detectNewClearing(sub: Subscription, latest: AnalysisResult): Detection {
  if (latest.verdict !== "flagged") return { fires: false };

  const window = latest.clearingDateRange;
  if (!window?.latest) return { fires: false };

  const prev = sub.lastAlertedClearingLatest;
  const isNewer = !prev || Date.parse(window.latest) > Date.parse(prev);
  if (!isNewer) return { fires: false };

  return {
    fires: true,
    reason:
      sub.lastVerdict === "flagged"
        ? "Additional clearing detected since the last alert."
        : "New clearing detected on a plot previously assessed clear.",
    clearingWindow: window,
  };
}

/** The "clear/observed as of" date: latest acquisition in the series. */
export function observedThrough(latest: AnalysisResult): string {
  const s = latest.forestFractionSeries;
  return s.length > 0 ? s[s.length - 1].date : latest.dataAccessedAt.slice(0, 10);
}
