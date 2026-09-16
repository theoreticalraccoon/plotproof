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
    typeof card.abstention?.threshold === "number" &&
    Array.isArray(card.taxonomy?.classes) &&
    card.taxonomy.classes.length > 0
  );
}

export function loadTeaCard(): Promise<TeaModelCard | null> {
  if (!cached) {
    cached = fetch(CARD_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (isUsable(j) ? j : null))
      .catch(() => null);
  }
  return cached;
}

/** Test seam: lets a test inject a card without a network. */
export function __setCardForTests(card: TeaModelCard | null): void {
  cached = Promise.resolve(card);
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

/** The worst-case accuracy observed on a cross-dataset test, for honest phrasing. */
export function crossDatasetAccuracyRange(card: TeaModelCard): { low: number; high: number } | null {
  const accs = Object.entries(card.evaluation?.key_metrics ?? {})
    .filter(([name]) => /cross-dataset/i.test(name))
    .map(([, m]) => m.accuracy);
  if (accs.length === 0) return null;
  return { low: Math.min(...accs), high: Math.max(...accs) };
}
