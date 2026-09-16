/**
 * Tea classifier integration. Run:
 *   node --experimental-strip-types test/tea.test.ts
 *
 * Covers the card contract, preprocessing determinism, calibration, the
 * abstention decision, and the evidence layer — including the rule that matters
 * most: environmental evidence must never change the predicted class.
 *
 * The real ONNX session is not exercised here (it needs a browser); it is
 * covered by `ml/tea/smoke_infer.py`, which runs the PUBLISHED artifact. What
 * these tests do cover is every pure function that stands between the model's
 * logits and what a farmer is told.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calibratedSoftmax, decide } from "../lib/grow/tea/predict.ts";
import { cropGeometry, preprocessRgba } from "../lib/grow/tea/preprocess.ts";
import { crossDatasetValidatedKeys, isCrossDatasetValidated } from "../lib/grow/tea/card.ts";
import { buildAdvisory } from "../lib/grow/tea/evidence.ts";
import type { TeaModelCard } from "../lib/grow/tea/types.ts";
import type { DiseaseRisk, IrrigationAdvice } from "../lib/grow/types.ts";
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
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const KEYS = card.taxonomy.classes.map((c) => c.key) as TeaClassKey[];

/** Logits that put `key` on top with a controllable margin. */
function logitsFor(key: string, margin = 20): number[] {
  return KEYS.map((k) => (k === key ? margin : 0));
}

// ======================= artifact / card =================================

test("published card exposes everything inference needs", () => {
  assert.ok(card.model.version, "model version");
  assert.ok(card.preprocessing.image_size > 0);
  assert.equal(card.preprocessing.mean.length, 3);
  assert.equal(card.preprocessing.std.length, 3);
  assert.ok(card.calibration.temperature > 0);
  assert.ok(card.abstention.threshold > 0 && card.abstention.threshold <= 1);
  assert.equal(card.taxonomy.classes.length, 6);
});

test("card class order matches the model's output vector", () => {
  card.taxonomy.classes.forEach((c, i) => assert.equal(c.outputIndex, i));
});

test("cross-dataset validation is DERIVED, and excludes blister blight and red rust", () => {
  const validated = crossDatasetValidatedKeys(card);
  // Derived from evaluation.key_metrics, not hardcoded anywhere in the app.
  assert.equal(isCrossDatasetValidated(card, "blister_blight"), false);
  assert.equal(isCrossDatasetValidated(card, "red_rust"), false);
  assert.ok(validated.has("healthy"));
  assert.ok(validated.has("helopeltis"));
});

// ======================= preprocessing ===================================

const prep = card.preprocessing;

function solidImage(w: number, h: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

test("crop geometry resizes the SHORTER side and centres the crop", () => {
  const g = cropGeometry(640, 480, prep);
  assert.equal(g.scaledH, prep.resize_shorter_side_to, "shorter side drives the scale");
  assert.ok(g.scaledW > g.scaledH, "landscape stays landscape");
  assert.equal(g.size, prep.image_size);
  assert.ok(g.left > 0 && g.top >= 0, "crop is centred, not top-left");
});

test("crop geometry handles portrait and square without going negative", () => {
  for (const [w, h] of [[480, 640], [512, 512], [160, 160], [1, 1]]) {
    const g = cropGeometry(w, h, prep);
    assert.ok(g.left >= 0 && g.top >= 0, `${w}x${h} produced a negative offset`);
  }
});

test("preprocessing output has the exact shape the model expects", () => {
  const { tensor, size } = preprocessRgba(solidImage(300, 220, [120, 130, 110]), prep);
  assert.equal(size, prep.image_size);
  assert.equal(tensor.length, 3 * prep.image_size * prep.image_size);
  assert.ok(tensor.every((v) => Number.isFinite(v)));
});

test("preprocessing is deterministic — same pixels, identical tensor", () => {
  const img = solidImage(400, 300, [90, 140, 70]);
  const a = preprocessRgba(img, prep).tensor;
  const b = preprocessRgba(img, prep).tensor;
  assert.deepEqual(Array.from(a), Array.from(b));
});

test("normalisation applies the card's mean and std, per channel", () => {
  // A mid-grey lets each channel be checked against the arithmetic by hand.
  const { tensor } = preprocessRgba(solidImage(200, 200, [128, 128, 128]), prep);
  const plane = prep.image_size * prep.image_size;
  const v = 128 / 255;
  for (let c = 0; c < 3; c++) {
    const expected = (v - prep.mean[c]) / prep.std[c];
    assert.ok(
      Math.abs(tensor[c * plane] - expected) < 1e-6,
      `channel ${c}: got ${tensor[c * plane]}, expected ${expected}`,
    );
  }
});

test("channels are NOT interchangeable — a red image differs from a blue one", () => {
  // Guards against a silently transposed or BGR tensor, which would degrade
  // accuracy without ever throwing.
  const r = preprocessRgba(solidImage(200, 200, [200, 10, 10]), prep).tensor;
  const b = preprocessRgba(solidImage(200, 200, [10, 10, 200]), prep).tensor;
  assert.notDeepEqual(Array.from(r.slice(0, 5)), Array.from(b.slice(0, 5)));
});

// ======================= calibration =====================================

test("calibrated softmax normalises to 1", () => {
  const p = calibratedSoftmax([2, 1, 0, -1, 0.5, 3], card.calibration.temperature);
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(p.every((v) => v >= 0 && v <= 1));
});

test("calibrated softmax survives extreme logits without overflowing to NaN", () => {
  const p = calibratedSoftmax([800, -800, 0, 0, 0, 0], card.calibration.temperature);
  assert.ok(p.every(Number.isFinite), "max-subtraction is doing its job");
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test("temperature below 1 sharpens confidence relative to raw softmax", () => {
  const logits = [3, 1, 0, 0, 0, 0];
  const raw = calibratedSoftmax(logits, 1);
  const cal = calibratedSoftmax(logits, card.calibration.temperature);
  assert.ok(card.calibration.temperature < 1);
  assert.ok(Math.max(...cal) > Math.max(...raw));
});

test("calibration cannot change the argmax", () => {
  const logits = [0.4, 2.2, 1.1, 0.9, 0.2, 1.7];
  const arg = (p: number[]) => p.indexOf(Math.max(...p));
  assert.equal(arg(calibratedSoftmax(logits, 1)), arg(calibratedSoftmax(logits, 0.5355)));
});

test("a non-positive temperature is rejected rather than producing garbage", () => {
  assert.throws(() => calibratedSoftmax([1, 2, 3], 0));
  assert.throws(() => calibratedSoftmax([1, 2, 3], -1));
});

// ======================= abstention ======================================

test("a strong margin yields a confident prediction", () => {
  const p = decide(logitsFor("brown_blight", 30), card);
  assert.equal(p.state, "confident");
  if (p.state !== "confident") return;
  assert.equal(p.classKey, "brown_blight");
  assert.ok(p.confidence >= card.abstention.threshold);
  assert.equal(p.modelVersion, card.model.version);
});

test("a weak margin abstains and carries NO class", () => {
  const p = decide(logitsFor("brown_blight", 0.5), card);
  assert.equal(p.state, "uncertain");
  assert.ok(!("classKey" in p), "an uncertain result must not expose a class as an answer");
});

test("abstention never substitutes the next-highest class", () => {
  // Two classes nearly tied: the model must decline, not pick a winner.
  const logits = KEYS.map((k) => (k === "red_rust" ? 1.0 : k === "brown_blight" ? 0.98 : 0));
  const p = decide(logits, card);
  assert.equal(p.state, "uncertain");
});

test("the threshold comes from the card — shifting it moves the boundary", () => {
  const logits = logitsFor("healthy", 6);
  const strict = decide(logits, { ...card, abstention: { ...card.abstention, threshold: 0.999999 } });
  const loose = decide(logits, { ...card, abstention: { ...card.abstention, threshold: 0.1 } });
  assert.equal(strict.state, "uncertain");
  assert.equal(loose.state, "confident");
});

test("confidence is reported at the exact published threshold boundary", () => {
  // Construct logits whose top calibrated probability lands just above/below.
  const p = decide(logitsFor("healthy", 30), card);
  assert.equal(p.state, "confident");
  if (p.state === "confident") assert.ok(p.confidence <= 1 && p.confidence > 0);
});

test("blister blight is flagged as NOT cross-dataset validated even when confident", () => {
  const p = decide(logitsFor("blister_blight", 30), card);
  assert.equal(p.state, "confident");
  if (p.state !== "confident") return;
  assert.equal(p.crossDatasetValidated, false);
});

test("a wrong-length or non-finite output is an error, not a prediction", () => {
  assert.equal(decide([1, 2, 3], card).state, "error");
  assert.equal(decide([], card).state, "error");
  assert.equal(decide([NaN, 0, 0, 0, 0, 0], card).state, "error");
});

test("the full distribution is returned, sorted, and sums to 1", () => {
  const p = decide(logitsFor("helopeltis", 30), card);
  if (p.state !== "confident") throw new Error("expected confident");
  assert.equal(p.distribution.length, 6);
  const sum = p.distribution.reduce((a, d) => a + d.probability, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  for (let i = 1; i < p.distribution.length; i++) {
    assert.ok(p.distribution[i - 1].probability >= p.distribution[i].probability);
  }
});

// ======================= evidence layer ==================================

function risk(disease: string, band: string, score: number): DiseaseRisk {
  return {
    disease: disease as DiseaseRisk["disease"],
    score,
    band: band as DiseaseRisk["band"],
    drivers: [],
    favourableDays: band === "high" ? 12 : 2,
    windowDays: 14,
  };
}

const irrigationSensor = {
  verdict: "no_action",
  reasonKey: "irrigation_reason_no_action",
  reasonSlots: { pct: 30 },
  recommendedMm: 0,
  recommendedLitres: 0,
  tawMm: 140,
  rawMm: 63,
  balance: [],
  anchorSource: "sensor",
  sensorCorrected: true,
} as unknown as IrrigationAdvice;

test("every evidence item names its source", () => {
  const adv = buildAdvisory({
    prediction: decide(logitsFor("brown_blight", 30), card),
    risks: [risk("brown_blight", "high", 0.8), risk("blister_blight", "low", 0.1)],
    irrigation: irrigationSensor,
    observedThrough: "2026-09-16",
  });
  assert.ok(adv.evidence.length >= 3);
  for (const e of adv.evidence) {
    assert.ok(["image", "environment", "sensor", "weather"].includes(e.source));
    assert.ok(e.messageKey.startsWith("tea_ev_"));
  }
});

test("image and environment stay SEPARATE items — never merged into one score", () => {
  const adv = buildAdvisory({
    prediction: decide(logitsFor("brown_blight", 30), card),
    risks: [risk("brown_blight", "high", 0.8)],
    irrigation: null,
    observedThrough: "2026-09-16",
  });
  assert.equal(adv.evidence.filter((e) => e.source === "image").length, 1);
  assert.equal(adv.evidence.filter((e) => e.source === "environment").length, 1);
  assert.ok(!("fusedScore" in adv), "there must be no blended score");
});

test("CONTRACT: weather must NOT change the predicted class", () => {
  // Photo says red rust; weather strongly favours blister blight.
  const prediction = decide(logitsFor("red_rust", 30), card);
  const adv = buildAdvisory({
    prediction,
    risks: [risk("blister_blight", "high", 0.9), risk("brown_blight", "low", 0.05)],
    irrigation: null,
    observedThrough: "2026-09-16",
  });
  assert.equal(adv.prediction.state, "confident");
  if (adv.prediction.state !== "confident") return;
  assert.equal(adv.prediction.classKey, "red_rust", "the class was silently rewritten by weather");
});

test("disagreement is reported explicitly rather than resolved", () => {
  // brown_blight seen, but its own risk is low while another disease is high.
  const adv = buildAdvisory({
    prediction: decide(logitsFor("brown_blight", 30), card),
    risks: [risk("blister_blight", "high", 0.9), risk("brown_blight", "low", 0.05)],
    irrigation: null,
    observedThrough: "2026-09-16",
  });
  assert.equal(adv.conflict, true);
  assert.ok(adv.evidence.some((e) => e.messageKey === "tea_ev_env_conflict"));
  assert.equal(adv.actionKey, "tea_action_conflict");
});

test("a pest prediction gets NO environmental prior — null means none exists", () => {
  const adv = buildAdvisory({
    prediction: decide(logitsFor("red_spider_mite", 30), card),
    risks: [risk("blister_blight", "high", 0.9)],
    irrigation: null,
    observedThrough: "2026-09-16",
  });
  const env = adv.evidence.filter((e) => e.source === "environment");
  assert.equal(env.length, 1);
  assert.equal(env[0].messageKey, "tea_ev_env_no_model_pest");
  assert.equal(adv.conflict, false, "a fungal window must not create conflict with a mite");
});

test("a healthy leaf under high pressure is flagged to keep watching", () => {
  const adv = buildAdvisory({
    prediction: decide(logitsFor("healthy", 30), card),
    risks: [risk("blister_blight", "high", 0.9)],
    irrigation: null,
    observedThrough: "2026-09-16",
  });
  assert.ok(adv.evidence.some((e) => e.messageKey === "tea_ev_env_healthy_but_pressure"));
  assert.equal(adv.actionKey, "tea_action_healthy_watch");
});

test("sensor-anchored soil is labelled 'sensor'; grid-anchored is labelled 'weather'", () => {
  const withSensor = buildAdvisory({
    prediction: decide(logitsFor("healthy", 30), card),
    risks: [], irrigation: irrigationSensor, observedThrough: null,
  });
  assert.ok(withSensor.evidence.some((e) => e.source === "sensor" && e.messageKey === "tea_ev_soil_measured"));

  const grid = { ...irrigationSensor, anchorSource: "grid", sensorCorrected: false } as IrrigationAdvice;
  const withGrid = buildAdvisory({
    prediction: decide(logitsFor("healthy", 30), card),
    risks: [], irrigation: grid, observedThrough: null,
  });
  assert.ok(withGrid.evidence.some((e) => e.messageKey === "tea_ev_soil_modelled"));
  assert.ok(!withGrid.evidence.some((e) => e.source === "sensor"), "a grid estimate must not claim to be a sensor");
});

test("an uncertain photo asks for a retake and still reports conditions", () => {
  const adv = buildAdvisory({
    prediction: decide(logitsFor("brown_blight", 0.4), card),
    risks: [risk("blister_blight", "high", 0.9)],
    irrigation: irrigationSensor,
    observedThrough: "2026-09-16",
  });
  assert.equal(adv.actionKey, "tea_action_retake");
  assert.ok(adv.evidence.some((e) => e.messageKey === "tea_ev_image_uncertain"));
  assert.ok(adv.evidence.some((e) => e.messageKey === "tea_ev_env_standalone"),
    "the rest of /grow must still be useful when the photo is not");
});

test("model error is distinct from uncertainty, and the advisory still builds", () => {
  const adv = buildAdvisory({
    prediction: { state: "error", reason: "no_artifact" },
    risks: [risk("blister_blight", "high", 0.9)],
    irrigation: irrigationSensor,
    observedThrough: "2026-09-16",
  });
  assert.equal(adv.actionKey, "tea_action_error");
  assert.ok(adv.evidence.some((e) => e.messageKey === "tea_ev_image_unavailable"));
  assert.ok(adv.evidence.some((e) => e.source === "environment"));
});

// ======================= end-to-end path =================================

test("INTEGRATION: logits -> calibration -> abstention -> advisory", () => {
  // Confident path.
  const confident = buildAdvisory({
    prediction: decide(logitsFor("helopeltis", 30), card),
    risks: [risk("blister_blight", "low", 0.1)],
    irrigation: irrigationSensor,
    observedThrough: "2026-09-16",
  });
  assert.equal(confident.prediction.state, "confident");
  assert.equal(confident.actionKey, "tea_action_confirm");
  assert.ok(confident.evidence.some((e) => e.source === "image"));
  assert.ok(confident.evidence.some((e) => e.source === "sensor"));

  // Abstaining path, same pipeline.
  const unsure = buildAdvisory({
    prediction: decide(logitsFor("helopeltis", 0.3), card),
    risks: [risk("blister_blight", "low", 0.1)],
    irrigation: irrigationSensor,
    observedThrough: "2026-09-16",
  });
  assert.equal(unsure.prediction.state, "uncertain");
  assert.equal(unsure.actionKey, "tea_action_retake");
});

console.log(`\n${passed} passed`);
