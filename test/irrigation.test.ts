/**
 * FAO-56 soil-water balance. Run:
 *   node --experimental-strip-types test/irrigation.test.ts
 *
 * These assertions are arithmetic against the published procedure, not against
 * a recorded snapshot — if a constant changes, a test should fail loudly rather
 * than quietly re-baseline.
 */
import assert from "node:assert/strict";
import {
  computeIrrigation,
  effectiveRain,
  adjustDepletionFraction,
  cropCoefficients,
} from "../lib/grow/irrigation.ts";
import type { DailyWeather } from "../lib/grow/types.ts";

const round = (n: number) => Math.round(n * 100) / 100;

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

function days(n: number, d: Partial<DailyWeather>): DailyWeather[] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    tMinC: 20,
    tMaxC: 30,
    tMeanC: 25,
    rhMeanPct: 70,
    precipMm: 0,
    et0Mm: 4,
    sunshineHours: 7,
    vpdKpa: 1.0,
    soilMoistureM3M3: null,
    soilMoistureRootZone: null,
    leafWetnessHours: 0,
    isForecast: false,
    ...d,
  }));
}

// --- effective rainfall ---
test("the canopy fills first, then sheds most of the rest", () => {
  // 12 mm − 1.2 mm canopy storage = 10.8 mm, −10% splash, −15% runoff.
  assert.equal(round(effectiveRain(12)), 8.26);
});
test("a shower smaller than the canopy can hold reaches the soil barely or not at all", () => {
  assert.equal(effectiveRain(0.8), 0, "fully intercepted");
  assert.ok(effectiveRain(1.5) < 0.3, `1.5 mm drizzle gave ${effectiveRain(1.5)} mm`);
  assert.equal(effectiveRain(0), 0);
});
test("effective rain rises monotonically with rainfall", () => {
  let prev = -1;
  for (const p of [0, 1, 2, 5, 10, 25, 60]) {
    const e = effectiveRain(p);
    assert.ok(e >= prev, `effectiveRain(${p}) = ${e} dropped below ${prev}`);
    prev = e;
  }
});

// --- FAO-56 Eq. 83 depletion-fraction adjustment ---
test("p is unchanged at the reference demand of 5 mm/day", () => {
  assert.equal(adjustDepletionFraction(0.4, 5), 0.4);
});
test("low demand tolerates more depletion, high demand less", () => {
  assert.ok(adjustDepletionFraction(0.4, 2) > 0.4);
  assert.ok(adjustDepletionFraction(0.4, 8) < 0.4);
});
test("p is clamped to the 0.1–0.8 range FAO-56 permits", () => {
  assert.equal(adjustDepletionFraction(0.65, -30), 0.8);
  assert.equal(adjustDepletionFraction(0.4, 40), 0.1);
});

// --- total available water ---
test("TAW follows 1000 x (FC - WP) x rootDepth", () => {
  // loam: FC 0.26, WP 0.12 → 0.14; tea root depth 1.0 m → 140 mm.
  const r = computeIrrigation({ days: days(1, { et0Mm: 0 }), crop: "tea", soilTexture: "loam", areaHa: 1 });
  assert.equal(r.tawMm, 140);
});
test("sand holds far less water than clay at the same depth", () => {
  const base = { days: days(1, { et0Mm: 0 }), crop: "tea" as const, areaHa: 1 };
  const sand = computeIrrigation({ ...base, soilTexture: "sand" });
  const clay = computeIrrigation({ ...base, soilTexture: "clay" });
  assert.ok(clay.tawMm > sand.tawMm * 1.5, `${clay.tawMm} vs ${sand.tawMm}`);
});

// --- the balance itself ---
test("a dry run depletes by ETc each day (ETc = ET0 x Kc)", () => {
  const r = computeIrrigation({ days: days(3, { et0Mm: 4 }), crop: "tea", soilTexture: "loam", areaHa: 1 });
  // Tea Kc = 1.0, so 4 mm/day with no rain.
  assert.equal(cropCoefficients("tea").kc, 1);
  assert.deepEqual(
    r.balance.map((b) => b.depletionMm),
    [4, 8, 12],
  );
});
test("depletion never goes below zero — excess rain is deep percolation, not credit", () => {
  const r = computeIrrigation({
    days: days(3, { et0Mm: 1, precipMm: 100 }),
    crop: "tea",
    soilTexture: "loam",
    areaHa: 1,
  });
  assert.ok(r.balance.every((b) => b.depletionMm === 0));
});
test("depletion is capped at TAW — the soil cannot dry beyond wilting point", () => {
  const r = computeIrrigation({
    days: days(200, { et0Mm: 8 }),
    crop: "tea",
    soilTexture: "loam",
    areaHa: 1,
  });
  assert.equal(r.balance[r.balance.length - 1].depletionMm, r.tawMm);
});

// --- the verdict ---
test("a well-watered profile says no action", () => {
  const r = computeIrrigation({
    days: days(10, { et0Mm: 2, precipMm: 20 }),
    crop: "tea",
    soilTexture: "loam",
    areaHa: 1,
  });
  assert.equal(r.verdict, "no_action");
  assert.equal(r.recommendedMm, 0);
});
test("the trigger fires once depletion reaches readily-available water", () => {
  const r = computeIrrigation({
    days: days(60, { et0Mm: 5 }),
    crop: "tea",
    soilTexture: "loam",
    areaHa: 1,
  });
  assert.equal(r.verdict, "water_now");
  assert.ok(r.balance[r.balance.length - 1].depletionMm >= r.rawMm);
});
test("heavy recent rain on a full profile reads as waterlogged, not as drought", () => {
  const r = computeIrrigation({
    days: days(5, { et0Mm: 1, precipMm: 40 }),
    crop: "tea",
    soilTexture: "clay",
    areaHa: 1,
  });
  assert.equal(r.verdict, "waterlogged");
  assert.equal(r.recommendedMm, 0);
});

// --- litres, which is the number a farmer can act on ---
test("1 mm over 1 ha is 10,000 litres", () => {
  const r = computeIrrigation({
    days: days(60, { et0Mm: 5 }),
    crop: "tea",
    soilTexture: "loam",
    areaHa: 0.5,
  });
  assert.equal(r.recommendedLitres, Math.round(r.recommendedMm * 0.5 * 10_000));
});

// --- the sensor overrides the model ---
test("a measured soil moisture replaces the accumulated estimate", () => {
  const dry = { days: days(60, { et0Mm: 5 }), crop: "tea" as const, soilTexture: "loam" as const, areaHa: 1 };
  const modelled = computeIrrigation(dry);
  assert.equal(modelled.sensorCorrected, false);
  assert.equal(modelled.verdict, "water_now");

  // Sensor says the profile is at field capacity, whatever the model accumulated.
  const measured = computeIrrigation({ ...dry, measuredSoilMoisture: 0.26 });
  assert.equal(measured.sensorCorrected, true);
  assert.equal(measured.balance[measured.balance.length - 1].depletionMm, 0);
  assert.equal(measured.verdict, "no_action");
});
test("a null sensor reading leaves the model untouched", () => {
  const base = { days: days(60, { et0Mm: 5 }), crop: "tea" as const, soilTexture: "loam" as const, areaHa: 1 };
  assert.equal(computeIrrigation({ ...base, measuredSoilMoisture: null }).sensorCorrected, false);
});

// --- the anchoring ladder: sensor > grid > balance ---
test("with no soil observation at all, the accumulated balance stands", () => {
  const r = computeIrrigation({
    days: days(60, { et0Mm: 5 }),
    crop: "tea",
    soilTexture: "loam",
    areaHa: 1,
  });
  assert.equal(r.anchorSource, "balance");
  assert.equal(r.sensorCorrected, false);
});

test("grid soil moisture overrides the accumulated balance when present", () => {
  // The balance would have run itself dry; the grid says the profile is full.
  const dry = days(60, { et0Mm: 5 });
  dry[dry.length - 1] = { ...dry[dry.length - 1], soilMoistureRootZone: 0.26 };
  const r = computeIrrigation({ days: dry, crop: "tea", soilTexture: "loam", areaHa: 1 });
  assert.equal(r.anchorSource, "grid");
  assert.equal(r.verdict, "no_action");
  assert.equal(r.sensorCorrected, false, "grid is not a sensor and must not claim to be");
});

test("a real sensor outranks the grid estimate", () => {
  const dry = days(60, { et0Mm: 5 });
  // Grid says full, sensor says bone dry. The sensor wins.
  dry[dry.length - 1] = { ...dry[dry.length - 1], soilMoistureRootZone: 0.26 };
  const r = computeIrrigation({
    days: dry,
    crop: "tea",
    soilTexture: "loam",
    areaHa: 1,
    measuredSoilMoisture: 0.12,
  });
  assert.equal(r.anchorSource, "sensor");
  assert.equal(r.verdict, "water_now");
});

test("frequent light rain is not swallowed by canopy interception", () => {
  // 3 mm/day against 3 mm/day of demand should roughly hold station, not
  // silently drain the profile — the bug live Nuwara Eliya data exposed.
  const r = computeIrrigation({
    days: days(30, { et0Mm: 3, precipMm: 3 }),
    crop: "tea",
    soilTexture: "clay_loam",
    areaHa: 1,
  });
  assert.ok(
    r.balance[r.balance.length - 1].depletionFraction < 0.5,
    `light rain drained the profile to ${r.balance[r.balance.length - 1].depletionFraction}`,
  );
});

// --- forecast handling ---
test("forecast days are excluded from the balance", () => {
  const observed = days(3, { et0Mm: 4 });
  const forecast = days(5, { et0Mm: 9 }).map((d) => ({ ...d, isForecast: true }));
  const r = computeIrrigation({
    days: [...observed, ...forecast],
    crop: "tea",
    soilTexture: "loam",
    areaHa: 1,
  });
  assert.equal(r.balance.length, 3);
});

console.log(`\n${passed} passed`);
