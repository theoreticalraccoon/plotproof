/**
 * Free public layer: a global, no-login map of flagged clearing plus public
 * dispute/confirmation submission (PROJECT.md "Free public layer").
 *
 * Two hard design rules:
 *  - PublicFeature is DE-IDENTIFIED. It carries a public id, never the internal
 *    plot id, and no farmer/cooperative identity. Publicly naming an unverified
 *    smallholder on a deforestation map would harm the people we protect.
 *  - A Dispute is a LABELLED TRAINING SAMPLE, not a support ticket. Its fields
 *    tie a human label to the exact satellite claim it corrects, so it can be
 *    exported as ground truth (crowdsourced labels are the only realistic way to
 *    get local ground truth at global scale, PROJECT.md).
 */

export type GeoPolygon = { type: "Polygon"; coordinates: number[][][] };

/** One flagged clearing patch, de-identified, safe to show publicly. */
export interface PublicFeature {
  id: string; // public id, NOT the internal plot id
  centroid: [number, number]; // [lng, lat]
  geometry: GeoPolygon;
  countryCode: string;
  commodity?: string;
  confidence: number; // 0..1 (shown to the public as a band, not a raw number)
  clearingWindow?: { earliest: string; latest: string };
  detectedAt: string; // ISO UTC
  observedThrough: string; // latest satellite acquisition considered
  modelVersion: string;
}

/** Agree it's clearing, or dispute it. Both are useful labels. */
export type DisputeStance = "confirm" | "dispute";

/**
 * WHY the reporter disputes, the categorical correction the model can learn
 * from. These map directly onto the hard confusions in ML.md (plantation vs
 * natural forest, legal harvest, pre-cutoff regrowth, mislocation, cloud).
 */
export type DisputeReason =
  | "not_forest_loss" // never was forest / bare land
  | "legal_harvest" // planned harvest or rotation, not deforestation
  | "plantation_not_natural" // mature plantation misread as natural forest
  | "regrowth_or_pre_cutoff" // cleared before the cutoff / has regrown
  | "wrong_location" // the flagged polygon is misplaced
  | "cloud_or_artifact" // imagery artefact, not real change
  | "other";

/** Ground-truth land cover the reporter observed, a direct training target. */
export type LandCover =
  | "natural_forest"
  | "mature_plantation"
  | "young_plantation"
  | "cropland"
  | "grassland"
  | "settlement"
  | "bare_soil"
  | "water"
  | "other";

/** Who reported, used to weight label trust, not to gate submission. */
export type ReporterType = "anonymous" | "journalist" | "ngo" | "researcher" | "official";

/** Curation lifecycle before a label is trusted for training. */
export type ReviewStatus = "unverified" | "corroborated" | "rejected";

/** A geotagged ground photo, the labelled image sample paired with the claim. */
export interface DisputePhoto {
  /** Inline data URL in the demo; a Storage path in production. */
  dataUrl?: string;
  path?: string;
  capturedAt?: string;
  lng?: number;
  lat?: number;
  accuracyM?: number;
  bytes?: number;
}

export interface Dispute {
  id: string;
  createdAt: string; // ISO UTC

  // --- what is being labelled ---
  /** The flagged feature confirmed/disputed, or null if the reporter dropped a
   *  new pin for clearing the model missed. */
  featureId?: string;
  location: [number, number]; // [lng, lat] the label applies to
  countryCode?: string;

  // --- the label (training target) ---
  stance: DisputeStance;
  reason?: DisputeReason; // when stance = dispute
  landCover?: LandCover;
  commodity?: string;

  // --- ground evidence ---
  onSite: boolean; // was the reporter physically there
  comment?: string;
  photo?: DisputePhoto;

  // --- ties the label to the satellite claim it corrects (training pairing) ---
  observedThrough?: string; // the "as of" date being labelled
  modelVersion?: string; // the model whose prediction this labels

  // --- provenance / trust ---
  reporterType: ReporterType;
  reporterName?: string; // optional attribution

  // --- curation ---
  reviewStatus: ReviewStatus;
}

/** The training-export projection: label fields only, no free-text/photo PII. */
export interface TrainingLabel {
  disputeId: string;
  lng: number;
  lat: number;
  countryCode?: string;
  label: DisputeStance;
  reason?: DisputeReason;
  landCover?: LandCover;
  commodity?: string;
  onSite: boolean;
  hasPhoto: boolean;
  observedThrough?: string;
  modelVersion?: string;
  reporterType: ReporterType;
  reviewStatus: ReviewStatus;
  createdAt: string;
}
