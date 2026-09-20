// Loads the published model card, the single source of truth for every model fact the app
// needs.
import type { TeaClassKey } from "../teaClasses";
import type { TeaModelCard } from "./types";

export const CARD_URL = "/models/tea-disease-mnv3s-card.json";
export const MODEL_URL = "/models/tea-disease-mnv3s.onnx";

let cached: Promise<TeaModelCard | null> | null = null;

// A card that parses but is missing the fields inference depends on is worse than no card: it
// would produce predictions from undefined constants.
export function isUsableCard(c: unknown): c is TeaModelCard {
  const card = c as TeaModelCard | null;
  return !!(
    card &&
    card.model?.version &&
    card.preprocessing?.image_size > 0 &&
    Array.isArray(card.preprocessing?.mean) &&
    card.preprocessing.mean.length === 3 &&
    Array.isArray(card.preprocessing?.std) &&
    card.preprocessing.std.length === 3 &&
    typeof card.calibration?.temperature === "number" &&
    card.calibration.temperature > 0 &&
    Array.isArray(card.taxonomy?.classes) &&
    card.taxonomy.classes.length > 0 &&
    // `predict.ts` maps logit i to classes[i].
    card.taxonomy.classes.every((c, i) => c.outputIndex === i) &&
    typeof card.abstention?.threshold === "number" &&
    Number.isFinite(card.abstention.threshold) &&
    card.abstention.threshold > 1 / card.taxonomy.classes.length &&
    card.abstention.threshold <= 1
  );
}

export function loadTeaCard(): Promise<TeaModelCard | null> {
  if (!cached) {
    cached = fetch(CARD_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (isUsableCard(j) ? j : null))
      .catch(() => null)
      .then((card) => {
        // A failed load is not remembered, so the next visit tries again.
        if (!card) cached = null;
        return card;
      });
  }
  return cached;
}

// --- derived facts ------------------------------------------------------

/** Which classes have been tested on a dataset they were not trained on. */
export function crossDatasetValidatedKeys(card: TeaModelCard): Set<string> {
  const keys = new Set<string>();
  for (const [name, m] of Object.entries(card.evaluation?.key_metrics ?? {})) {
    if (!/cross-dataset/i.test(name)) continue;
    for (const k of m.classes_present ?? []) keys.add(k);
  }
  return keys;
}

export function isCrossDatasetValidated(card: TeaModelCard, key: TeaClassKey): boolean {
  return crossDatasetValidatedKeys(card).has(key);
}

// How often the model DECLINES to answer on photographs from farms it has never seen, as a
// fraction, the worst case across the published cross-dataset test sets.
export function crossDatasetDeclineRate(card: TeaModelCard): number | null {
  const cov = card.abstention?.coverage_by_test_set;
  if (!cov) return null;
  const rates = Object.entries(cov)
    .filter(([name]) => /cross-dataset/i.test(name))
    .map(([, v]) => v.coverage)
    .filter((c) => typeof c === "number" && c >= 0 && c <= 1);
  if (rates.length === 0) return null;
  return 1 - Math.min(...rates);
}
