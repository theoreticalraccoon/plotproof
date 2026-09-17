/**
 * Loads the published model card — the single source of truth for every model
 * fact the app needs.
 *
 * Same contract as `lib/prices/types.ts`: fetch a static artifact, cache the
 * promise, and resolve to null when it is absent so the caller renders nothing
 * rather than a guess. No model constant is duplicated into a component.
 */
import type { TeaClassKey } from "../teaClasses";
import type { TeaModelCard } from "./types";

export const CARD_URL = "/models/tea-disease-mnv3s-card.json";
export const MODEL_URL = "/models/tea-disease-mnv3s.onnx";

let cached: Promise<TeaModelCard | null> | null = null;

/**
 * A card that parses but is missing the fields inference depends on is worse
 * than no card: it would produce predictions from undefined constants. Validate
 * the load-bearing ones and treat a malformed card as an absent one.
 *
 * The abstention threshold gets its own bound, found by the adversarial audit.
 * `typeof threshold === "number"` accepted 0, and a threshold of 0 does not
 * merely weaken abstention — it DISABLES it, turning a near-uniform 16.9%
 * guess into a "confident" diagnosis on a farmer's screen. A real threshold
 * must at minimum beat chance (1/numClasses); anything at or below that is a
 * corrupt or tampered card, not a permissive one.
 */
function isUsable(c: unknown): c is TeaModelCard {
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
    // `predict.ts` maps logit i to classes[i]. That is only correct while the
    // array is in output order, and nothing in the JSON enforces it — a card
    // listing the same six classes alphabetically would parse, validate and
    // then silently rename every diagnosis. Checked here because it is
    // unobservable downstream: the wrong answer looks exactly like a right one.
    card.taxonomy.classes.every((c, i) => c.outputIndex === i) &&
    typeof card.abstention?.threshold === "number" &&
    Number.isFinite(card.abstention.threshold) &&
    card.abstention.threshold > 1 / card.taxonomy.classes.length &&
    card.abstention.threshold <= 1
  );
}

/** Test seam: the audit asserts directly that a tampered card is refused. */
export const __isUsableCardForTests = isUsable;

export function loadTeaCard(): Promise<TeaModelCard | null> {
  if (!cached) {
    cached = fetch(CARD_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (isUsable(j) ? j : null))
      .catch(() => null);
  }
  return cached;
}

// --- derived facts ------------------------------------------------------

/**
 * Which classes have been tested on a dataset they were not trained on.
 *
 * DERIVED from the card's own evaluation block rather than hardcoded, so it
 * cannot drift from the numbers it describes. A class counts as externally
 * validated only if it is present in a CROSS-DATASET test set — Test 1 shares
 * CS-D's domain and proves nothing about transfer.
 *
 * As published this yields: healthy, brown_blight, helopeltis, red_spider_mite.
 * Blister blight and red rust appear in no external dataset in the audited
 * corpus, so the UI must never imply they were externally checked.
 */
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

/**
 * How often the model DECLINES to answer on photographs from farms it has never
 * seen, as a fraction — the worst case across the published cross-dataset test
 * sets.
 *
 * This exists because abstention looks like breakage from the outside. At the
 * published threshold the model answers roughly a third of cross-dataset field
 * photos, so a farmer taking real photographs will meet "uncertain" far more
 * often than an answer, and without being told why that reads as a broken
 * feature rather than a careful one.
 *
 * Derived from `abstention.coverage_by_test_set`, never written down here, and
 * deliberately the WORST (lowest coverage) cross-dataset set rather than an
 * average: the in-distribution set answers 95% of the time and would flatter
 * the number into uselessness. Returns null when the card does not publish
 * coverage, so the UI simply says less.
 */
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
