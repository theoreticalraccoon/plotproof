/** Types for the tea-leaf classifier's app-side integration. */
import type { TeaClassKey } from "../teaClasses";

// --- the published card -------------------------------------------------

export interface CardClass {
  outputIndex: number;
  classId: number;
  key: TeaClassKey;
  displayName: string;
  kind: string;
}

export interface CardPreprocessing {
  image_size: number;
  resize_shorter_side_to: number;
  crop: string;
  channel_order: string;
  mean: [number, number, number];
  std: [number, number, number];
}

export interface CardTestMetrics {
  samples: number;
  accuracy: number;
  macro_f1: number;
  ece: number;
  classes_present: string[];
  classes_absent: string[];
}

export interface TeaModelCard {
  schemaVersion: number;
  model: {
    name: string;
    version: string;
    architecture: string;
    file: string;
    bytes: number;
    sha256: string;
    parameters: number;
    trained_at: string;
  };
  taxonomy: { taxonomy_version: number; classes: CardClass[] };
  preprocessing: CardPreprocessing;
  evaluation: { key_metrics: Record<string, CardTestMetrics> };
  calibration: { method: string; temperature: number; fitted_on: string; note: string };
  abstention: {
    threshold: number;
    selection_rule: string;
    behaviour: string;
    /** Fraction of each test set the model ANSWERED at this threshold, published per test set. */
    coverage_by_test_set?: Record<string, { coverage: number; accuracy_on_accepted: number }>;
  };
  known_limitations: string[];
  attribution: string[];
}

// --- prediction ---------------------------------------------------------

/** Three states, deliberately disjoint. */
export type TeaPrediction =
  | {
      state: "confident";
      classKey: TeaClassKey;
      displayName: string;
      /** Calibrated probability of the top class. NOT a probability of being right. */
      confidence: number;
      /** All six, calibrated, for the detail view. */
      distribution: { key: TeaClassKey; displayName: string; probability: number }[];
      modelVersion: string;
      /** False for blister_blight and red_rust, no external test set contains them. */
      crossDatasetValidated: boolean;
    }
  | {
      state: "uncertain";
      /** What it leaned toward, for logging only. NEVER rendered as an answer. */
      topKeyForDiagnosticsOnly: TeaClassKey;
      confidence: number;
      threshold: number;
      modelVersion: string;
    }
  | {
      state: "error";
      /** Distinguishes "model could not run" from "model is unsure". */
      reason: "no_artifact" | "load_failed" | "bad_image" | "inference_failed";
      detail?: string;
    };

// --- evidence -----------------------------------------------------------

/** Where a piece of evidence came from. */
export type EvidenceSource = "image" | "environment" | "sensor" | "weather";

export type EvidenceStance = "supports" | "neutral" | "tension" | "observation";

export interface EvidenceItem {
  source: EvidenceSource;
  stance: EvidenceStance;
  /** i18n key + slots, this layer never builds user-facing prose itself. */
  messageKey: string;
  slots: Record<string, string | number>;
  // Slot names whose VALUE is itself an i18n key, to be translated by the renderer before
  // interpolation.
  translatedSlots?: string[];
}

/** The combined view. Note what is absent: there is no fused score and no corrected class. */
export interface TeaAdvisory {
  prediction: TeaPrediction;
  evidence: EvidenceItem[];
  /** True when image and environment point in materially different directions. */
  conflict: boolean;
  /** i18n key for the "what to do next" line. */
  actionKey: string;
  actionSlots: Record<string, string | number>;
}
