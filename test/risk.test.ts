/**
 * Disease infection-risk engine. Run:
 *   node --experimental-strip-types test/risk.test.ts
 *
 * The cases that matter are the ones that must NOT fire: a single wet day, and
 * a warm bright spell. An advisory that cries wolf is worse than no advisory.
 */
import assert from "node:assert/strict";
import { assessDisease, assessAll } from "../lib/grow/risk.ts";
import { deriveLeafWetnessHours } from "../lib/weather/derive.ts";
import type { DailyWeather } from "../lib/grow/types.ts";

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

/** Build a run of identical days ending today, all marked observed. */
function days(n: number, d: Partial<DailyWeather>): DailyWeather[] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    tMinC: 16,
    tMaxC: 24,
    tMeanC: 20,
    rhMeanPct: 92,
    precipMm: 8,
    et0Mm: 3,
    sunshineHours: 1.5,
    vpdKpa: 0.3,
    soilMoistureM3M3: 0.3,
    soilMoistureRootZone: null,
    leafWetnessHours: 16,
    isForecast: false,
    ...d,
  }));
}

// --- leaf wetness estimator ---
test("leaf wetness counts rain hours and RH>=90 hours, without double counting", () => {
  // 3 hours of rain, 2 more hours at 95% RH with no rain, 1 dry bright hour.
  const rh = [95, 95, 95, 95, 95, 40];
  const precip = [1, 1, 1, 0, 0, 0];
  assert.equal(deriveLeafWetnessHours(rh, precip), 5);
});
test("leaf wetness handles nulls (gappy grid rows) without counting them", () => {
  assert.equal(deriveLeafWetnessHours([null, null, 95], [null, null, 0]), 1);
});

// --- blister blight: the flagship ---
test("14 days inside the blister-blight window scores high", () => {
  const r = assessDisease(days(14, {}), "blister_blight");
  assert.equal(r.band, "high");
  assert.ok(r.score > 0.9, `expected >0.9, got ${r.score}`);
  assert.equal(r.favourableDays, 14);
});

test("a warm, bright, dry fortnight scores low", () => {
  const r = assessDisease(
    days(14, { tMeanC: 30, rhMeanPct: 55, sunshineHours: 9, leafWetnessHours: 0, precipMm: 0 }),
    "blister_blight",
  );
  assert.equal(r.band, "low");
  assert.equal(r.score, 0);
  assert.equal(r.favourableDays, 0);
});

test("ONE wet day in a dry fortnight does not raise the alarm", () => {
  const series = days(14, {
    tMeanC: 30,
    rhMeanPct: 55,
    sunshineHours: 9,
    leafWetnessHours: 0,
    precipMm: 0,
  });
  // Insert a single perfect infection day in the middle.
  series[7] = { ...series[7], tMeanC: 20, rhMeanPct: 92, sunshineHours: 1, leafWetnessHours: 16 };
  const r = assessDisease(series, "blister_blight");
  assert.equal(r.band, "low", `single wet day produced ${r.band} (${r.score})`);
});

test("leaf wetness gates the score: perfect temperature on a dry leaf scores zero", () => {
  const r = assessDisease(days(14, { leafWetnessHours: 0, precipMm: 0 }), "blister_blight");
  assert.equal(r.score, 0);
});

test("a sustained run scores above the same number of scattered days", () => {
  const dry = { tMeanC: 30, rhMeanPct: 55, sunshineHours: 9, leafWetnessHours: 0, precipMm: 0 };
  const wet = { tMeanC: 20, rhMeanPct: 92, sunshineHours: 1, leafWetnessHours: 16 };

  const consecutive = days(14, dry).map((d, i) => (i >= 9 ? { ...d, ...wet } : d));
  const scattered = days(14, dry).map((d, i) => (i % 3 === 0 ? { ...d, ...wet } : d));

  const a = assessDisease(consecutive, "blister_blight");
  const b = assessDisease(scattered, "blister_blight");
  assert.ok(a.score > b.score, `run ${a.score} should beat scatter ${b.score}`);
});

// --- forecast days must not be scored as if observed ---
test("forecast days are excluded from the score", () => {
  const observedDry = days(14, {
    tMeanC: 30,
    rhMeanPct: 55,
    sunshineHours: 9,
    leafWetnessHours: 0,
    precipMm: 0,
  });
  const forecastWet = days(7, {}).map((d) => ({ ...d, isForecast: true }));
  const r = assessDisease([...observedDry, ...forecastWet], "blister_blight");
  assert.equal(r.score, 0, "a wet forecast must not create observed risk");
});

// --- temperature separates the diseases ---
test("cool wet conditions favour blister blight over the warm-optimum blights", () => {
  const ranked = assessAll(days(14, { tMeanC: 19 }));
  assert.equal(ranked[0].disease, "blister_blight");
});
test("warm wet conditions rank a warm-optimum blight first", () => {
  const ranked = assessAll(days(14, { tMeanC: 28, sunshineHours: 4 }));
  assert.notEqual(ranked[0].disease, "blister_blight");
});

// --- drivers explain the score ---
test("drivers are ranked and name real measured values", () => {
  const r = assessDisease(days(14, {}), "blister_blight");
  assert.ok(r.drivers.length > 0);
  assert.equal(r.drivers[0].key, "risk_driver_leaf_wetness");
  assert.equal(r.drivers[0].slots.hours, 16);
  for (let i = 1; i < r.drivers.length; i++) {
    assert.ok(r.drivers[i - 1].weight >= r.drivers[i].weight, "drivers must be sorted by weight");
  }
});

test("no weather at all returns a zero score, not a crash", () => {
  const r = assessDisease([], "blister_blight");
  assert.equal(r.score, 0);
  assert.equal(r.band, "low");
  assert.deepEqual(r.drivers, []);
});

console.log(`\n${passed} passed`);
