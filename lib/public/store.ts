/**
 * Public-layer store. In-memory for now (per-process; demo/dev), behind simple
 * functions so the Supabase-backed version is a drop-in later.
 *
 * FEATURES is deliberately EMPTY and must stay that way until it is fed by a
 * real, citable detection source (JRC Forest Observatory / Global Forest Watch
 * / RADD), surfaced as a DE-IDENTIFIED view. This list previously held seeded
 * demo polygons at real coordinates in real countries. Publishing invented
 * clearing at a real location is a false accusation against whoever farms it,
 * so seed data is never acceptable here, not even temporarily. Reports written
 * by actual people (DISPUTES, below) are real and are kept.
 */
import type {
  Dispute,
  DisputeStance,
  PublicFeature,
  TrainingLabel,
} from "./types";

const FEATURES: PublicFeature[] = [];

const DISPUTES: Dispute[] = [];

export function listFeatures(): PublicFeature[] {
  return FEATURES;
}
export function getFeature(id: string): PublicFeature | undefined {
  return FEATURES.find((f) => f.id === id);
}

/** Per-feature confirm/dispute tallies for the map (no PII). */
export function disputeCounts(): Record<string, { confirm: number; dispute: number }> {
  const counts: Record<string, { confirm: number; dispute: number }> = {};
  for (const d of DISPUTES) {
    if (!d.featureId) continue;
    (counts[d.featureId] ??= { confirm: 0, dispute: 0 })[d.stance]++;
  }
  return counts;
}

/** GeoJSON FeatureCollection with public props + report tallies. */
export function featureCollection() {
  const counts = disputeCounts();
  return {
    type: "FeatureCollection" as const,
    features: FEATURES.map((f) => ({
      type: "Feature" as const,
      id: f.id,
      geometry: f.geometry,
      properties: {
        id: f.id,
        countryCode: f.countryCode,
        commodity: f.commodity,
        confidence: f.confidence,
        clearingWindow: f.clearingWindow,
        detectedAt: f.detectedAt,
        observedThrough: f.observedThrough,
        modelVersion: f.modelVersion,
        centroid: f.centroid,
        reports: counts[f.id] ?? { confirm: 0, dispute: 0 },
      },
    })),
  };
}

export interface NewDispute {
  featureId?: string;
  location: [number, number];
  countryCode?: string;
  stance: DisputeStance;
  reason?: Dispute["reason"];
  landCover?: Dispute["landCover"];
  commodity?: string;
  onSite?: boolean;
  comment?: string;
  photo?: Dispute["photo"];
  observedThrough?: string;
  modelVersion?: string;
  reporterType?: Dispute["reporterType"];
  reporterName?: string;
}

export function addDispute(input: NewDispute): Dispute {
  // If tied to a feature, inherit the satellite claim it labels.
  const feature = input.featureId ? getFeature(input.featureId) : undefined;
  const dispute: Dispute = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    featureId: input.featureId,
    location: input.location,
    countryCode: input.countryCode ?? feature?.countryCode,
    stance: input.stance,
    reason: input.reason,
    landCover: input.landCover,
    commodity: input.commodity ?? feature?.commodity,
    onSite: input.onSite ?? false,
    comment: input.comment?.trim() || undefined,
    photo: input.photo,
    observedThrough: input.observedThrough ?? feature?.observedThrough,
    modelVersion: input.modelVersion ?? feature?.modelVersion,
    reporterType: input.reporterType ?? "anonymous",
    reporterName: input.reporterName?.trim() || undefined,
    reviewStatus: "unverified",
  };
  DISPUTES.push(dispute);
  return dispute;
}

export function listDisputes(): Dispute[] {
  return DISPUTES;
}

/** Training-export projection: label fields only, free-text/photo PII dropped. */
export function toTrainingLabels(): TrainingLabel[] {
  return DISPUTES.map((d) => ({
    disputeId: d.id,
    lng: d.location[0],
    lat: d.location[1],
    countryCode: d.countryCode,
    label: d.stance,
    reason: d.reason,
    landCover: d.landCover,
    commodity: d.commodity,
    onSite: d.onSite,
    hasPhoto: Boolean(d.photo),
    observedThrough: d.observedThrough,
    modelVersion: d.modelVersion,
    reporterType: d.reporterType,
    reviewStatus: d.reviewStatus,
    createdAt: d.createdAt,
  }));
}
