/**
 * Adversarial audit of the /grow decision pipeline. Run:
 *   node --experimental-strip-types test/growAudit.test.ts
 *
 * These are not happy-path tests. Every case here asks what the system does when
 * its evidence sources disagree, fail, go stale, or are absent — because that is
 * the condition a farmer actually uses it in, and because a system that only
 * behaves when everything works is not a system, it is a demo.
 *
 * Section 2 of the audit: soil/irrigation, disease/image, evidence conflict.
 * Section 9: the ten evidence invariants, stated as executable assertions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeIrrigation } from "../lib/grow/irrigation.ts";
import { assessAll } from "../lib/grow/risk.ts";
import { decide } from "../lib/grow/tea/predict.ts";
import { buildAdvisory } from "../lib/grow/tea/evidence.ts";
import { guardVwc, isPlausibleVwc } from "../lib/grow/sensorGuard.ts";
import { __isUsableCardForTests as isUsableCard } from "../lib/grow/tea/card.ts";
import type { TeaModelCard } from "../lib/grow/tea/types.ts";
import type { DailyWeather, DiseaseRisk, IrrigationAdvice } from "../lib/grow/types.ts";
import type { TeaClassKey } from "../lib/grow/teaClasses.ts";

const card = JSON.parse(
  readFileSync(new URL("../public/models/tea-disease-mnv3s-card.json", import.meta.url), "utf8"),
) as TeaModelCard;

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error("      " + (err instanceof Error ? err.message : err));
    process.exitCode = 1;
  }
}

const KEYS = card.taxonomy.classes.map((c) => c.key) as TeaClassKey[];
const logitsFor = (key: string, margin = 30) => KEYS.map((k) => (k === key ? margin : 0));

function days(n: number, d: Partial<DailyWeather>): DailyWeather[] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    tMinC: 20, tMaxC: 30, tMeanC: 25, rhMeanPct: 70, precipMm: 0, et0Mm: 4,
    sunshineHours: 7, vpdKpa: 1, soilMoistureM3M3: null, soilMoistureRootZone: null,
    leafWetnessHours: 0, isForecast: false, ...d,
  }));
}

function risk(disease: string, band: string, score: number): DiseaseRisk {
  return {
    disease: disease as DiseaseRisk["disease"], score, band: band as DiseaseRisk["band"],
    drivers: [], favourableDays: band === "high" ? 12 : 1, windowDays: 14,
  };
}

const LOAM = { crop: "tea" as const, soilTexture: "loam" as const, areaHa: 1 };

// =====================================================================
// SOIL / IRRIGATION
// =====================================================================

test("saturated soil + heavy rain reads as waterlogged, never as 'water now'", () => {
  const r = computeIrrigation({ ...LOAM, days: days(5, { et0Mm: 1, precipMm: 45 }) });
  assert.equal(r.verdict, "waterlogged");
  assert.equal(r.recommendedMm, 0);
});

test("dry soil + no rain reaches 'water now' with a positive quantity", () => {
  const r = computeIrrigation({ ...LOAM, days: days(60, { et0Mm: 5 }) });
  assert.equal(r.verdict, "water_now");
  assert.ok(r.recommendedMm > 0 && r.recommendedLitres > 0);
});

test("ANCHOR LADDER: sensor outranks grid outranks balance", () => {
  const dry = days(60, { et0Mm: 5 });
  const withGrid = dry.map((d, i) =>
    i === dry.length - 1 ? { ...d, soilMoistureRootZone: 0.26 } : d);

  assert.equal(computeIrrigation({ ...LOAM, days: dry }).anchorSource, "balance");
  assert.equal(computeIrrigation({ ...LOAM, days: withGrid }).anchorSource, "grid");
  assert.equal(
    computeIrrigation({ ...LOAM, days: withGrid, measuredSoilMoisture: 0.12 }).anchorSource,
    "sensor",
  );
});

test("sensor available but weather unavailable: no weather means no advisory at all", () => {
  // The balance cannot run without ET0/rain. An empty series must not silently
  // produce a confident "no action" from a sensor reading alone.
  const r = computeIrrigation({ ...LOAM, days: [], measuredSoilMoisture: 0.12 });
  assert.equal(r.balance.length, 0, "no weather days means no balance rows");
});

test("weather available but sensor unavailable falls back to grid, never claims sensor", () => {
  const withGrid = days(30, { et0Mm: 4, soilMoistureRootZone: 0.25 });
  const r = computeIrrigation({ ...LOAM, days: withGrid, measuredSoilMoisture: null });
  assert.equal(r.anchorSource, "grid");
  assert.equal(r.sensorCorrected, false, "a grid estimate must never be labelled a measurement");
});

test("INVARIANT 4: a missing sensor is not read as zero moisture", () => {
  // vwc 0 would mean bone dry and force "water now". Absent must mean absent.
  const wet = days(10, { et0Mm: 1, precipMm: 30 });
  const absent = computeIrrigation({ ...LOAM, days: wet, measuredSoilMoisture: null });
  const zero = computeIrrigation({ ...LOAM, days: wet, measuredSoilMoisture: 0 });
  assert.notEqual(absent.anchorSource, "sensor");
  assert.equal(zero.anchorSource, "sensor");
  assert.notEqual(absent.verdict, zero.verdict, "absent and zero must not behave identically");
});

test("implausible sensor values are rejected before they reach the balance", () => {
  // A miscalibrated probe can emit anything. Volumetric water content is a
  // fraction: outside roughly [0, 0.7] it is not a soil reading, it is a fault.
  for (const bad of [-0.5, 1.5, 5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(isPlausibleVwc(bad), false, `${bad} should be rejected`);
  }
  for (const good of [0, 0.12, 0.26, 0.45, 0.6]) {
    assert.equal(isPlausibleVwc(good), true, `${good} should be accepted`);
  }
});

test("a rejected sensor value degrades to the next tier, not to a wrong answer", () => {
  const withGrid = days(30, { et0Mm: 4, soilMoistureRootZone: 0.25 });
  const guarded = isPlausibleVwc(9.9) ? 9.9 : null;
  const r = computeIrrigation({ ...LOAM, days: withGrid, measuredSoilMoisture: guarded });
  assert.equal(r.anchorSource, "grid");
});

test("grid and sensor disagreeing: the sensor wins and says so", () => {
  const gridSaysFull = days(60, { et0Mm: 5 }).map((d, i, arr) =>
    i === arr.length - 1 ? { ...d, soilMoistureRootZone: 0.26 } : d);
  const r = computeIrrigation({ ...LOAM, days: gridSaysFull, measuredSoilMoisture: 0.12 });
  assert.equal(r.anchorSource, "sensor");
  assert.equal(r.verdict, "water_now");
});

test("balance and sensor disagreeing: the observation beats the integration", () => {
  const r = computeIrrigation({ ...LOAM, days: days(60, { et0Mm: 5 }), measuredSoilMoisture: 0.26 });
  assert.equal(r.anchorSource, "sensor");
  assert.equal(r.verdict, "no_action");
});

test("light frequent rain is not swallowed into a false deficit", () => {
  const r = computeIrrigation({ ...LOAM, days: days(30, { et0Mm: 3, precipMm: 3 }) });
  assert.ok(r.balance.at(-1)!.depletionFraction < 0.5);
});

test("extreme rainfall does not produce negative depletion or negative litres", () => {
  const r = computeIrrigation({ ...LOAM, days: days(10, { et0Mm: 1, precipMm: 400 }) });
  assert.ok(r.balance.every((b) => b.depletionMm >= 0));
  assert.ok(r.recommendedLitres >= 0);
});

test("consecutive rain events keep the profile full without overflowing", () => {
  const series = days(20, { et0Mm: 3 }).map((d, i) => (i % 4 === 0 ? { ...d, precipMm: 35 } : d));
  const r = computeIrrigation({ ...LOAM, days: series });
  assert.ok(r.balance.every((b) => b.depletionMm >= 0 && b.depletionMm <= r.tawMm));
});

// =====================================================================
// DISEASE / IMAGE — error != uncertain != confident
// =====================================================================

test("INVARIANT: the three prediction states are disjoint", () => {
  const confident = decide(logitsFor("brown_blight", 30), card);
  const unsure = decide(logitsFor("brown_blight", 0.4), card);
  const broken = decide([1, 2], card);
  assert.equal(confident.state, "confident");
  assert.equal(unsure.state, "uncertain");
  assert.equal(broken.state, "error");
  assert.ok("classKey" in confident);
  assert.ok(!("classKey" in unsure), "INVARIANT 5: abstention must expose no class");
  assert.ok(!("classKey" in broken));
});

test("confidence just above the threshold is confident; just below abstains", () => {
  // Bisect a margin that straddles the published threshold.
  let lo = 0, hi = 40;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (decide(logitsFor("healthy", mid), card).state === "confident") hi = mid;
    else lo = mid;
  }
  assert.equal(decide(logitsFor("healthy", hi + 0.01), card).state, "confident");
  assert.equal(decide(logitsFor("healthy", lo - 0.01), card).state, "uncertain");
});

test("INVARIANT 6: a model error never becomes 'retake the photo'", () => {
  for (const reason of ["no_artifact", "load_failed", "bad_image", "inference_failed"] as const) {
    const adv = buildAdvisory({
      prediction: { state: "error", reason },
      risks: [risk("blister_blight", "high", 0.9)],
      irrigation: null,
      observedThrough: "2026-09-16",
    });
    assert.equal(adv.actionKey, "tea_action_error", `${reason} produced ${adv.actionKey}`);
    assert.notEqual(adv.actionKey, "tea_action_retake");
  }
});

test("every error reason has a distinct user-facing i18n key", () => {
  const strings = readFileSync(new URL("../lib/i18n/strings.ts", import.meta.url), "utf8");
  for (const reason of ["no_artifact", "load_failed", "bad_image", "inference_failed"]) {
    assert.ok(strings.includes(`tea_error_${reason}:`), `missing tea_error_${reason}`);
  }
});

test("a malformed model output is an error, and never a class", () => {
  for (const bad of [[], [1, 2, 3], [NaN, 0, 0, 0, 0, 0], [Infinity, 0, 0, 0, 0, 0]]) {
    const p = decide(bad, card);
    assert.equal(p.state, "error");
  }
});

// =====================================================================
// EVIDENCE CONFLICT
// =====================================================================

test("INVARIANT 1+2: weather never changes the CNN class, in any conflict", () => {
  const cases: [string, string][] = [
    ["blister_blight", "brown_blight"],
    ["red_rust", "blister_blight"],
    ["brown_blight", "blister_blight"],
    ["red_spider_mite", "blister_blight"],
    ["helopeltis", "grey_blight"],
    ["healthy", "blister_blight"],
  ];
  for (const [seen, favoured] of cases) {
    const adv = buildAdvisory({
      prediction: decide(logitsFor(seen, 30), card),
      risks: [risk(favoured, "high", 0.95), risk(seen === favoured ? "grey_blight" : seen, "low", 0.02)],
      irrigation: null,
      observedThrough: "2026-09-16",
    });
    assert.equal(adv.prediction.state, "confident");
    if (adv.prediction.state !== "confident") continue;
    assert.equal(adv.prediction.classKey, seen, `weather rewrote ${seen} while favouring ${favoured}`);
  }
});

test("image predicts a pest while pathogen risk is high: no conflict is manufactured", () => {
  const adv = buildAdvisory({
    prediction: decide(logitsFor("red_spider_mite", 30), card),
    risks: [risk("blister_blight", "high", 0.95)],
    irrigation: null,
    observedThrough: "2026-09-16",
  });
  assert.equal(adv.conflict, false);
  // INVARIANT 9: no pathogen prior attaches to a pest.
  const env = adv.evidence.filter((e) => e.source === "environment");
  assert.equal(env.length, 1);
  assert.equal(env[0].messageKey, "tea_ev_env_no_model_pest");
});

test("uncertain image + high environmental risk: still no class, still useful", () => {
  const adv = buildAdvisory({
    prediction: decide(logitsFor("blister_blight", 0.3), card),
    risks: [risk("blister_blight", "high", 0.95)],
    irrigation: null,
    observedThrough: "2026-09-16",
  });
  assert.equal(adv.prediction.state, "uncertain");
  assert.equal(adv.actionKey, "tea_action_retake");
  // High pressure must NOT be allowed to confirm the discarded guess.
  assert.ok(!adv.evidence.some((e) => e.messageKey === "tea_ev_image_confident"));
  assert.ok(adv.evidence.some((e) => e.messageKey === "tea_ev_env_standalone"));
});

test("confident image + weak environment: reported as tension, class unchanged", () => {
  const adv = buildAdvisory({
    prediction: decide(logitsFor("brown_blight", 30), card),
    risks: [risk("brown_blight", "low", 0.05)],
    irrigation: null,
    observedThrough: "2026-09-16",
  });
  assert.equal(adv.prediction.state, "confident");
  assert.ok(adv.evidence.some((e) => e.messageKey === "tea_ev_env_low"));
});

test("INVARIANT 3: a grid estimate never presents itself as a sensor observation", () => {
  const grid = {
    verdict: "water_now", reasonKey: "irrigation_reason_water_now", reasonSlots: { pct: 80 },
    recommendedMm: 50, recommendedLitres: 500000, tawMm: 140, rawMm: 63, balance: [],
    anchorSource: "grid", sensorCorrected: false,
  } as unknown as IrrigationAdvice;
  const adv = buildAdvisory({
    prediction: decide(logitsFor("healthy", 30), card),
    risks: [], irrigation: grid, observedThrough: null,
  });
  assert.ok(!adv.evidence.some((e) => e.source === "sensor"));
  assert.ok(adv.evidence.some((e) => e.messageKey === "tea_ev_soil_modelled"));
});

test("sensor says saturated while the balance says dry: sensor wins, advisory agrees", () => {
  const r = computeIrrigation({ ...LOAM, days: days(60, { et0Mm: 5 }), measuredSoilMoisture: 0.26 });
  const adv = buildAdvisory({
    prediction: decide(logitsFor("healthy", 30), card),
    risks: [], irrigation: r, observedThrough: "2026-09-16",
  });
  assert.equal(r.verdict, "no_action");
  const soil = adv.evidence.find((e) => e.messageKey === "tea_ev_soil_measured");
  assert.ok(soil, "a real measurement should be labelled as measured");
  assert.equal(soil!.slots.verdict, "no_action", "the advisory must not contradict the anchor");
});

// =====================================================================
// INVARIANTS 8 + 10
// =====================================================================

test("INVARIANT 8: blister blight and red rust are never marked externally validated", () => {
  for (const key of ["blister_blight", "red_rust"]) {
    const p = decide(logitsFor(key, 30), card);
    assert.equal(p.state, "confident");
    if (p.state !== "confident") continue;
    assert.equal(p.crossDatasetValidated, false, `${key} claimed external validation`);
  }
});

test("classes that DO have external evidence are marked as such", () => {
  for (const key of ["healthy", "helopeltis"]) {
    const p = decide(logitsFor(key, 30), card);
    if (p.state !== "confident") throw new Error("expected confident");
    assert.equal(p.crossDatasetValidated, true, `${key} should be externally validated`);
  }
});

test("INVARIANT 10: the action never claims more than the strongest source supports", () => {
  // No image result + high weather risk must not yield a treat-this instruction.
  const adv = buildAdvisory({
    prediction: { state: "error", reason: "load_failed" },
    risks: [risk("blister_blight", "high", 0.95)],
    irrigation: null,
    observedThrough: "2026-09-16",
  });
  assert.equal(adv.actionKey, "tea_action_error");
  assert.notEqual(adv.actionKey, "tea_action_confirm");

  // Conflicting evidence must not produce a confident treatment instruction.
  const conflicted = buildAdvisory({
    prediction: decide(logitsFor("brown_blight", 30), card),
    risks: [risk("blister_blight", "high", 0.95), risk("brown_blight", "low", 0.02)],
    irrigation: null,
    observedThrough: "2026-09-16",
  });
  assert.equal(conflicted.actionKey, "tea_action_conflict");
});

test("no advisory ever reaches a treat-now instruction without a confident image", () => {
  const nonConfident = [
    decide(logitsFor("brown_blight", 0.3), card),
    { state: "error", reason: "no_artifact" } as const,
  ];
  for (const prediction of nonConfident) {
    const adv = buildAdvisory({
      prediction, risks: [risk("brown_blight", "high", 0.95)],
      irrigation: null, observedThrough: "2026-09-16",
    });
    assert.notEqual(adv.actionKey, "tea_action_confirm");
  }
});

// =====================================================================
// REGRESSIONS - the four defects this audit found
// =====================================================================

test("AUDIT BUG 1: a zeroed abstention threshold is rejected, not obeyed", () => {
  // Proven live before the fix: threshold 0 turned a near-uniform 16.9% guess
  // into a "confident" diagnosis. Validation now demands better than chance.
  const numClasses = card.taxonomy.classes.length;
  const uniform = card.taxonomy.classes.map((_, i) => (i === 2 ? 0.3 : 0.29));

  assert.equal(decide(uniform, card).state, "uncertain");

  for (const bad of [0, -1, 1 / numClasses, 0.05, 1.5, Number.NaN]) {
    const tampered = { ...card, abstention: { ...card.abstention, threshold: bad } };
    assert.equal(
      isUsableCard(tampered), false,
      `threshold ${bad} was accepted; abstention could be silently disabled`,
    );
  }
  assert.equal(isUsableCard(card), true, "the real published card must still load");
});

test("AUDIT BUG 3: an implausible sensor reading demotes instead of outranking", () => {
  // computeIrrigation clamps depletion, so 9.9 m3/m3 does not look wrong - it
  // silently becomes "profile full, no action" from the TOP tier of the ladder.
  const dry = days(60, { et0Mm: 5 });
  const unguarded = computeIrrigation({ ...LOAM, days: dry, measuredSoilMoisture: 9.9 });
  assert.equal(unguarded.verdict, "no_action", "documents the hazard the guard prevents");

  const guarded = computeIrrigation({ ...LOAM, days: dry, measuredSoilMoisture: guardVwc(9.9) });
  assert.equal(guarded.anchorSource, "balance");
  assert.equal(guarded.verdict, "water_now", "a broken probe must not suppress a real need to water");
});

test("AUDIT BUG 4 (invariant 7): no non-tea crop is a predictable class", () => {
  for (const crop of ["rubber", "coconut", "cinnamon"]) {
    assert.ok(!KEYS.includes(crop as TeaClassKey), `${crop} must not be a predictable class`);
  }
});

test("AUDIT BUG 4: the unsupported-crop refusal message exists and names the crop", () => {
  const strings = readFileSync(new URL("../lib/i18n/strings.ts", import.meta.url), "utf8");
  assert.ok(strings.includes("tea_crop_unsupported:"), "missing tea_crop_unsupported");
  const line = strings.split(String.fromCharCode(10)).find((l) => l.includes("tea_crop_unsupported:"))!;
  assert.ok(line.includes("{crop}"), "the message must name the crop it is refusing");
});

test("AUDIT: assessAll is only ever fed weather, never a crop assumption", () => {
  // Guards invariant 7 upstream: risk.ts models Camellia sinensis pathogens, and
  // useGrowPlot gates it on crop === "tea". Here we assert the engine itself
  // stays crop-agnostic so the gate remains the single place that decides.
  const out = assessAll(days(14, { tMeanC: 20, rhMeanPct: 92, leafWetnessHours: 16, sunshineHours: 1 }));
  assert.equal(out.length, 3);
  assert.ok(out.every((r) => ["blister_blight", "brown_blight", "grey_blight"].includes(r.disease)));
});

console.log(`\n${passed} passed`);
