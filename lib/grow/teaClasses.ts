/**
 * Canonical tea-condition classes — the contract between the trained model and
 * the app.
 *
 * TypeScript mirror of `models/tea/taxonomy.json`, which is the source of truth
 * and carries the full evidence for every merge decision. If you change one,
 * change both; `test/teaClasses.test.ts` fails if they drift.
 *
 * Two rules this file exists to enforce:
 *
 * 1. **Class IDs are stable forever.** The model emits a vector whose positions
 *    are `ACTIVE_CLASS_IDS`, in order. Raw dataset folder names ("Gray Blight",
 *    "Tea_Mosquito_Bug") never reach the app — three datasets spell the same
 *    condition three different ways, and one of those pairs is the same insect
 *    under two common names.
 *
 * 2. **Pests are not pathogens.** Two of the six active classes are insects and
 *    mites, not fungi. `lib/grow/risk.ts` models weather-driven infection
 *    windows for FUNGAL pathogens only, so the two label spaces are related but
 *    not equal. `riskEngineKey` is the explicit, auditable bridge between them,
 *    and it is `null` wherever no bridge exists. Fusion must consult it rather
 *    than assuming the two taxonomies line up — they do not.
 */
import type { TeaDisease } from "./types";

export type TeaClassKey =
  | "healthy"
  | "blister_blight"
  | "brown_blight"
  | "red_rust"
  | "red_spider_mite"
  | "helopeltis"
  | "grey_blight"
  | "algal_leaf_spot"
  | "red_leaf_spot"
  | "green_mirid_bug"
  | "looper";

/** What kind of thing the class is. Drives whether an environmental prior applies. */
export type TeaConditionKind =
  | "healthy"
  | "fungal_disease"
  | "algal_disease"
  | "pest"
  | "unclear";

export interface TeaClass {
  /** Stable forever. Never renumber; activating a reserved class is a retrain. */
  classId: number;
  key: TeaClassKey;
  displayName: string;
  kind: TeaConditionKind;
  /** Emitted by the v1 model? Reserved classes are declared but not predicted. */
  active: boolean;
  /**
   * Bridge to `lib/grow/risk.ts`. Null where the risk engine has no model for
   * this condition — every pest, and every disease outside its three pathogens.
   * Null means "no environmental prior exists", NOT "prior is neutral".
   */
  riskEngineKey: TeaDisease | null;
  /** Can this class be tested on a dataset it was not trained on? */
  crossDatasetTestable: boolean;
  /** Source-dataset folder labels that map here, for the training loader. */
  sourceLabels: string[];
}

/**
 * Ordered by classId. IDs 6–10 are declared but inactive: they exist so that a
 * later dataset can activate them without renumbering anything the v1 model
 * already emitted.
 */
export const TEA_CLASSES: readonly TeaClass[] = [
  {
    classId: 0,
    key: "healthy",
    displayName: "Healthy",
    kind: "healthy",
    active: true,
    riskEngineKey: null,
    crossDatasetTestable: true,
    // "Healthy leaf" / "Healthy Leaf" differ only in case across two datasets,
    // and normalise to the same key, so only one spelling is listed.
    sourceLabels: ["Healthy_leaves", "Healthy", "Healthy leaf"],
  },
  {
    classId: 1,
    key: "blister_blight",
    displayName: "Blister blight",
    kind: "fungal_disease",
    active: true,
    riskEngineKey: "blister_blight",
    // Single-source: no other tea dataset examined contains this class, so
    // there is nothing to test it against. The most important class in the
    // product is also the least verifiable one.
    crossDatasetTestable: false,
    sourceLabels: ["Blister_Blight"],
  },
  {
    classId: 2,
    key: "brown_blight",
    displayName: "Brown blight",
    kind: "fungal_disease",
    active: true,
    riskEngineKey: "brown_blight",
    crossDatasetTestable: true,
    sourceLabels: ["Brown_Blight", "Brown Blight"],
  },
  {
    classId: 3,
    key: "red_rust",
    displayName: "Red rust",
    kind: "algal_disease",
    active: true,
    riskEngineKey: null,
    crossDatasetTestable: false,
    sourceLabels: ["Leaf_Red_Rust", "Red Rust"],
  },
  {
    classId: 4,
    key: "red_spider_mite",
    displayName: "Red spider mite",
    kind: "pest",
    active: true,
    riskEngineKey: null,
    crossDatasetTestable: false,
    sourceLabels: ["Red_Spider_Mite", "Red spider", "Red Spider"],
  },
  {
    classId: 5,
    key: "helopeltis",
    displayName: "Tea mosquito bug (Helopeltis)",
    kind: "pest",
    active: true,
    riskEngineKey: null,
    crossDatasetTestable: true,
    sourceLabels: ["Tea_Mosquito_Bug", "Helopeltis"],
  },

  // --- reserved, not emitted by the v1 model --------------------------------
  {
    classId: 6,
    key: "grey_blight",
    displayName: "Grey blight",
    kind: "fungal_disease",
    active: false,
    riskEngineKey: "grey_blight",
    crossDatasetTestable: false,
    sourceLabels: ["Gray Blight", "Grey Blight"],
  },
  {
    classId: 7,
    key: "algal_leaf_spot",
    displayName: "Algal leaf spot",
    kind: "algal_disease",
    active: false,
    riskEngineKey: null,
    crossDatasetTestable: false,
    sourceLabels: ["Algal Leaf Spot", "Tea algal leaf spot", "Algal Leaf"],
  },
  {
    classId: 8,
    key: "red_leaf_spot",
    displayName: "Red leaf spot",
    kind: "unclear",
    active: false,
    riskEngineKey: null,
    crossDatasetTestable: false,
    sourceLabels: ["Red Leaf Spot"],
  },
  {
    classId: 9,
    key: "green_mirid_bug",
    displayName: "Green mirid bug",
    kind: "pest",
    active: false,
    riskEngineKey: null,
    crossDatasetTestable: false,
    sourceLabels: ["Green mirid bug"],
  },
  {
    classId: 10,
    key: "looper",
    displayName: "Looper caterpillar damage",
    kind: "pest",
    active: false,
    riskEngineKey: null,
    crossDatasetTestable: false,
    sourceLabels: ["Looper Infested"],
  },
] as const;

export const TAXONOMY_VERSION = 1;

/** The model's output vector, in order. Position i is `ACTIVE_CLASSES[i]`. */
export const ACTIVE_CLASSES: readonly TeaClass[] = TEA_CLASSES.filter((c) => c.active);

export const ACTIVE_CLASS_IDS: readonly number[] = ACTIVE_CLASSES.map((c) => c.classId);

export function teaClassById(classId: number): TeaClass | undefined {
  return TEA_CLASSES.find((c) => c.classId === classId);
}

export function teaClassByKey(key: TeaClassKey): TeaClass | undefined {
  return TEA_CLASSES.find((c) => c.key === key);
}

/**
 * Map a raw dataset folder name to a canonical class.
 *
 * Case- and separator-insensitive, because the same condition is spelled
 * "Brown_Blight", "Brown Blight" and "brown blight" across three datasets.
 * Returns undefined rather than guessing: an unmapped folder is a dataset
 * change that a human should look at, not something to silently bucket.
 */
export function teaClassFromSourceLabel(label: string): TeaClass | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  const target = norm(label);
  return TEA_CLASSES.find((c) => c.sourceLabels.some((l) => norm(l) === target));
}

/**
 * Does an environmental infection-risk prior exist for this class?
 *
 * The honest answer is no for every pest and for any disease outside the risk
 * engine's three pathogens. Fusion uses this to decide whether the weather
 * evidence is even applicable — a red-spider-mite prediction must not be
 * up- or down-weighted by a fungal infection window that says nothing about mites.
 */
export function hasEnvironmentalPrior(c: TeaClass): boolean {
  return c.riskEngineKey !== null;
}
