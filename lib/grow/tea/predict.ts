/** Logits -> calibrated probabilities -> a prediction state. */
import type { TeaClassKey } from "../teaClasses.ts";
import type { TeaModelCard, TeaPrediction } from "./types";
import { isCrossDatasetValidated } from "./card.ts";

/** Temperature-scaled softmax, matching `ml/tea/evaluate.py`. */
export function calibratedSoftmax(logits: readonly number[], temperature: number): number[] {
  if (!(temperature > 0)) throw new Error(`Invalid temperature: ${temperature}`);
  const z = logits.map((v) => v / temperature);
  const max = Math.max(...z);
  const exps = z.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Turn a raw model output into one of three disjoint states. */
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
