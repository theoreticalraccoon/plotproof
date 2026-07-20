/**
 * Public-layer store. In-memory for now (per-process; demo/dev), behind simple
 * functions so the Supabase-backed version is a drop-in later. Flagged features
 * would in production be a DE-IDENTIFIED view of flagged analysis runs; here
 * they're seeded across the tropics so the global map reads as global.
 */
import type {
  Dispute,
  DisputeStance,
  GeoPolygon,
  PublicFeature,
  TrainingLabel,
} from "./types";

function square(lng: number, lat: number, d = 0.004): GeoPolygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + d, lat],
        [lng + d, lat + d],
        [lng, lat + d],
        [lng, lat],
      ],
    ],
  };
}

interface SeedSpec {
  id: string;
  lng: number;
  lat: number;
  countryCode: string;
  commodity: string;
  confidence: number;
  window: [string, string];
  observedThrough: string;
}

// Spread across the tropical commodity belt — the "global" story.
const SEED: SeedSpec[] = [
  { id: "fc-lk-1", lng: 80.30, lat: 6.75, countryCode: "LK", commodity: "rubber", confidence: 0.88, window: ["2023-02-01", "2023-03-15"], observedThrough: "2026-06-20" },
  { id: "fc-id-1", lng: 101.45, lat: -0.50, countryCode: "ID", commodity: "oil palm", confidence: 0.93, window: ["2022-08-01", "2022-09-10"], observedThrough: "2026-06-18" },
  { id: "fc-id-2", lng: 112.80, lat: -1.80, countryCode: "ID", commodity: "oil palm", confidence: 0.76, window: ["2024-05-01", "2024-07-01"], observedThrough: "2026-06-12" },
  { id: "fc-vn-1", lng: 108.05, lat: 12.68, countryCode: "VN", commodity: "coffee", confidence: 0.71, window: ["2023-11-01", "2024-01-20"], observedThrough: "2026-06-22" },
  { id: "fc-ci-1", lng: -6.50, lat: 6.80, countryCode: "CI", commodity: "cocoa", confidence: 0.84, window: ["2022-12-01", "2023-02-01"], observedThrough: "2026-06-15" },
  { id: "fc-gh-1", lng: -2.20, lat: 6.30, countryCode: "GH", commodity: "cocoa", confidence: 0.67, window: ["2024-01-01", "2024-03-01"], observedThrough: "2026-06-10" },
  { id: "fc-br-1", lng: -52.30, lat: -5.60, countryCode: "BR", commodity: "cattle", confidence: 0.95, window: ["2023-06-01", "2023-07-15"], observedThrough: "2026-06-25" },
  { id: "fc-pe-1", lng: -74.50, lat: -8.50, countryCode: "PE", commodity: "timber", confidence: 0.79, window: ["2024-08-01", "2024-10-01"], observedThrough: "2026-06-14" },
  { id: "fc-cm-1", lng: 13.20, lat: 3.80, countryCode: "CM", commodity: "timber", confidence: 0.72, window: ["2023-03-01", "2023-05-01"], observedThrough: "2026-06-08" },
  { id: "fc-pg-1", lng: 144.30, lat: -6.20, countryCode: "PG", commodity: "timber", confidence: 0.81, window: ["2024-02-01", "2024-04-01"], observedThrough: "2026-06-05" },
  { id: "fc-my-1", lng: 117.20, lat: 5.30, countryCode: "MY", commodity: "oil palm", confidence: 0.89, window: ["2022-10-01", "2022-11-15"], observedThrough: "2026-06-19" },
  { id: "fc-ph-1", lng: 125.30, lat: 8.10, countryCode: "PH", commodity: "oil palm", confidence: 0.63, window: ["2024-06-01", "2024-08-01"], observedThrough: "2026-06-11" },
  { id: "fc-cd-1", lng: 23.50, lat: 0.50, countryCode: "CD", commodity: "timber", confidence: 0.74, window: ["2023-09-01", "2023-11-01"], observedThrough: "2026-06-03" },
  { id: "fc-co-1", lng: -73.80, lat: 2.50, countryCode: "CO", commodity: "cattle", confidence: 0.83, window: ["2024-03-01", "2024-05-01"], observedThrough: "2026-06-16" },
];

const FEATURES: PublicFeature[] = SEED.map((s) => ({
  id: s.id,
  centroid: [s.lng + 0.002, s.lat + 0.002],
  geometry: square(s.lng, s.lat),
  countryCode: s.countryCode,
  commodity: s.commodity,
  confidence: s.confidence,
  clearingWindow: { earliest: s.window[0], latest: s.window[1] },
  detectedAt: new Date(`${s.window[1]}T00:00:00Z`).toISOString(),
  observedThrough: s.observedThrough,
  modelVersion: "stub-0.0.0",
}));

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
