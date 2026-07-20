/**
 * Monitoring decision logic. Run:
 *   node --experimental-strip-types test/monitoring.test.ts
 * Covers the cadence due-check and the new-vs-already-reported clearing rule.
 */
import assert from "node:assert/strict";
import { detectNewClearing, isDue } from "../lib/monitoring/detect.ts";
import type { Subscription } from "../lib/monitoring/types.ts";
import type { AnalysisResult } from "../lib/analysis/types.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const DAY = 86_400_000;
const now = Date.parse("2026-07-01T00:00:00Z");

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "s1",
    plotId: "p1",
    exporterId: "e1",
    channel: "email",
    target: "a@b.c",
    cadenceDays: 7,
    active: true,
    countryCode: "LK",
    commodity: "rubber",
    cutoffDate: "2020-12-31",
    geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0]]] },
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function result(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    plotId: "p1",
    jobId: "j1",
    verdict: "clear",
    confidence: 0.9,
    forestFractionSeries: [{ date: "2026-06-20", forestFraction: 0.8, sensor: "S2", cloudCover: 0.1 }],
    imagery: [],
    modelVersion: "stub-0.0.0",
    dataAccessedAt: "2026-06-30T00:00:00Z",
    ...overrides,
  };
}

// --- cadence ---
test("never-checked subscription is due", () => {
  assert.equal(isDue(sub(), now), true);
});
test("checked within cadence is not due", () => {
  assert.equal(isDue(sub({ lastCheckedAt: new Date(now - 3 * DAY).toISOString() }), now), false);
});
test("checked beyond cadence is due", () => {
  assert.equal(isDue(sub({ lastCheckedAt: new Date(now - 8 * DAY).toISOString() }), now), true);
});
test("inactive subscription is never due", () => {
  assert.equal(isDue(sub({ active: false }), now), false);
});

// --- new-clearing detection ---
test("clear result does not fire", () => {
  assert.equal(detectNewClearing(sub(), result({ verdict: "clear" })).fires, false);
});
test("clear -> flagged fires", () => {
  const d = detectNewClearing(
    sub({ lastVerdict: "clear" }),
    result({ verdict: "flagged", clearingDateRange: { earliest: "2026-06-01", latest: "2026-06-15" } }),
  );
  assert.equal(d.fires, true);
});
test("same clearing window does not re-fire", () => {
  const d = detectNewClearing(
    sub({ lastVerdict: "flagged", lastAlertedClearingLatest: "2026-06-15" }),
    result({ verdict: "flagged", clearingDateRange: { earliest: "2026-06-01", latest: "2026-06-15" } }),
  );
  assert.equal(d.fires, false);
});
test("later clearing window fires again (additional clearing)", () => {
  const d = detectNewClearing(
    sub({ lastVerdict: "flagged", lastAlertedClearingLatest: "2026-06-15" }),
    result({ verdict: "flagged", clearingDateRange: { earliest: "2026-06-20", latest: "2026-06-28" } }),
  );
  assert.equal(d.fires, true);
});

console.log(`\n${passed} passed`);
