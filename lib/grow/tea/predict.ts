/**
 * Logits -> calibrated probabilities -> a prediction state.
 *
 * Pure. No DOM, no ONNX, no network — so `test/teaPredict.test.ts` exercises
 * the exact code that runs in production, including the abstention decision
 * that the whole safety story rests on.
 *
 * The abstention threshold is never written down here. It comes from the card,
 * and `decide()` cannot be called without one.
 */
import type { TeaClassKey } from "../teaClasses.ts";
import type { TeaModelCard, TeaPrediction } from "./types";
import { isCrossDatasetValidated } from "./card.ts";

/**
 * Temperature-scaled softmax, matching `ml/tea/evaluate.py`.
 *
 * Max-subtraction before exponentiating is not cosmetic: without it a logit of
 * ~800 overflows to Infinity and every probability becomes NaN.
 */
export function calibratedSoftmax(logits: readonly number[], temperature: number): number[] {
  if (!(temperature > 0)) throw new Error(`Invalid temperature: ${temperature}`);
  const z = logits.map((v) => v / temperature);
  const max = Math.max(...z);
  const exps = z.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/**
 * Turn a raw model output into one of three disjoint states.
 *
 * The rule that matters: below the card's threshold this returns `uncertain`
 * with NO class. It does not return the top class with a caveat, and it does not
 * fall back to second place. The model is ~70% accurate outside its training
 * domain while remaining confident, so a low-confidence answer is not a weak
 * answer — it is an answer the model has not earned the right to give.
 */
export function decide(logits: readonly number[], card: TeaModelCard): TeaPrediction {
  const classes = card.taxonomy.classes;

  if (!Array.isArray(logits) || logits.length !== classes.length) {
    return {
      state: "error",
      reason: "inference_failed",
      detail: `Model returned ${logits?.length ?? 0} outputs, expected ${classes.length}`,
    };
  }
  if (logits.some((v) => !Number.isFinite(v))) {
    return { state: "error", reason: "inference_failed", detail: "Model returned a non-finite value" };
  }

  const probs = calibratedSoftmax(logits, card.calibration.temperature);
  let topIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[topIdx]) topIdx = i;

  const top = classes[topIdx];
  const confidence = probs[topIdx];
  const threshold = card.abstention.threshold;
  const version = card.model.version;

  if (confidence < threshold) {
    return {
      state: "uncertain",
      topKeyForDiagnosticsOnly: top.key as TeaClassKey,
      confidence,
      threshold,
      modelVersion: version,
    };
  }

  return {
    state: "confident",
    classKey: top.key as TeaClassKey,
    displayName: top.displayName,
    confidence,
    distribution: classes
      .map((c, i) => ({
        key: c.key as TeaClassKey,
        displayName: c.displayName,
        probability: probs[i],
      }))
      .sort((a, b) => b.probability - a.probability),
    modelVersion: version,
    crossDatasetValidated: isCrossDatasetValidated(card, top.key as TeaClassKey),
  };
}
