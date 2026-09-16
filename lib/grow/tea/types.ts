/**
 * Types for the tea-leaf classifier's app-side integration.
 *
 * The published model card is the source of truth for every model fact. These
 * types describe its shape; they do not restate its values. No threshold, class
 * name, temperature or preprocessing constant is written down anywhere in the
 * app — read them from the card or they will drift the first time the model is
 * retrained.
 */
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
  abstention: { threshold: number; selection_rule: string; behaviour: string };
  known_limitations: string[];
  attribution: string[];
}

// --- prediction ---------------------------------------------------------

/**
 * Three states, deliberately disjoint. "uncertain" is NOT a low-confidence
 * prediction with a class attached — it carries no class at all, because
 * offering the next-best guess is exactly what the abstention threshold exists
 * to prevent.
 */
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
      /** False for blister_blight and red_rust — no external test set contains them. */
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

/**
 * Where a piece of evidence came from. Rendered on every row, because the whole
 * point of this layer is that the farmer can tell an observation from an
 * inference, and a photograph from a weather model.
 */
export type EvidenceSource = "image" | "environment" | "sensor" | "weather";

export type EvidenceStance = "supports" | "neutral" | "tension" | "observation";

export interface EvidenceItem {
  source: EvidenceSource;
  stance: EvidenceStance;
  /** i18n key + slots — this layer never builds user-facing prose itself. */
  messageKey: string;
  slots: Record<string, string | number>;
}

/**
 * The combined view. Note what is absent: there is no fused score and no
 * corrected class. `prediction` is whatever the image said, untouched.
 * Environmental evidence can raise or lower plausibility in the narrative, and
 * can openly disagree, but it can never change the class.
 */
export interface TeaAdvisory {
  prediction: TeaPrediction;
  evidence: EvidenceItem[];
  /** True when image and environment point in materially different directions. */
  conflict: boolean;
  /** i18n key for the "what to do next" line. */
  actionKey: string;
  actionSlots: Record<string, string | number>;
}
