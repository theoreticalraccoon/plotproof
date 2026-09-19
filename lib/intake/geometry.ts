// Plot geometry validation. Pure functions, no browser/DB dependency, so this module is
// unit-testable in Node (see test/geometry.test.ts).
import {
  area as turfArea,
  booleanIntersects,
  intersect,
  kinks,
  polygon as turfPolygon,
  featureCollection,
  centerOfMass,
} from "@turf/turf";
import type { LngLat, PlotValidation, ValidationError, ValidationWarning } from "./types";

/** Default: warn if computed area differs from claimed by more than this ratio. */
export const AREA_MISMATCH_RATIO = 0.2; // ±20%
/** Overlaps below this many hectares are treated as boundary-touch noise. */
export const OVERLAP_MIN_HA = 0.001; // ~10 m²

// Centre of a plot as [lng, lat], for anything that needs a POINT rather than a boundary, the
// weather grid cell, a sensor's registered position, a map pin.
export function plotCentre(ring: LngLat[]): { lng: number; lat: number } | null {
  const closed = closeRing(dedupeConsecutive(ring));
  if (closed.length < 4) return null;
  try {
    const [lng, lat] = centerOfMass(turfPolygon([closed])).geometry.coordinates;
    return { lng, lat };
  } catch {
    return null;
  }
}

/** Close a ring: append the first point if it isn't already the last. */
export function closeRing(points: LngLat[]): LngLat[] {
  if (points.length === 0) return points;
  const [fx, fy] = points[0];
  const [lx, ly] = points[points.length - 1];
  return fx === lx && fy === ly ? points : [...points, [fx, fy]];
}

/** Drop consecutive duplicate points (a common tapping artefact). */
export function dedupeConsecutive(points: LngLat[]): LngLat[] {
  const out: LngLat[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) out.push(p);
  }
  return out;
}

// Order points into a simple polygon by angle around the centroid. Used for CORNER CAPTURE,
// where corners are tapped out of order.
export function autoOrderRing(points: LngLat[]): LngLat[] {
  const pts = dedupeConsecutive(points);
  if (pts.length < 3) return pts;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [...pts].sort(
    (a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx),
  );
}

/** True if the closed ring crosses itself. turf `kinks` finds intersections. */
export function isSelfIntersecting(ring: LngLat[]): boolean {
  const closed = closeRing(ring);
  if (closed.length < 4) return false; // not enough to self-cross
  try {
    return kinks(turfPolygon([closed])).features.length > 0;
  } catch {
    // A degenerate ring turf can't build is handled by other checks.
    return false;
  }
}

/** Geodesic area of the plot in hectares. */
export function computeAreaHa(ring: LngLat[]): number {
  const closed = closeRing(ring);
  if (closed.length < 4) return 0;
  try {
    return turfArea(turfPolygon([closed])) / 10_000;
  } catch {
    return 0;
  }
}

/** Ratio |computed - claimed| / claimed, or null if no claim to compare. */
export function areaDivergence(computedHa: number, claimedHa?: number): number | null {
  if (!claimedHa || claimedHa <= 0) return null;
  return Math.abs(computedHa - claimedHa) / claimedHa;
}

export interface ExistingPlot {
  id: string;
  ring: LngLat[];
}

/** Ids of existing plots whose INTERIOR overlaps the candidate. */
export function findOverlaps(ring: LngLat[], existing: ExistingPlot[]): string[] {
  const closed = closeRing(ring);
  if (closed.length < 4) return [];
  const candidate = safePolygon(closed);
  if (!candidate) return [];

  const hits: string[] = [];
  for (const other of existing) {
    const otherPoly = safePolygon(closeRing(other.ring));
    if (!otherPoly) continue;
    // Cheap reject first: if bounding geometries don't even intersect, skip.
    if (!booleanIntersects(candidate, otherPoly)) continue;
    try {
      const inter = intersect(featureCollection([candidate, otherPoly]));
      if (inter && turfArea(inter) / 10_000 > OVERLAP_MIN_HA) hits.push(other.id);
    } catch {
      // If intersect fails on a pathological geometry, fall back to the conservative signal that
      // they intersect at all.
      hits.push(other.id);
    }
  }
  return hits;
}

function safePolygon(closed: LngLat[]) {
  try {
    return turfPolygon([closed]);
  } catch {
    return null;
  }
}

export interface ValidateOptions {
  method: "imported" | "traced" | "corners" | "walked";
  claimedAreaHa?: number;
  existingPlots?: ExistingPlot[];
  areaMismatchRatio?: number;
}

// Full pre-save pipeline. Orders (for corner capture), validates, measures, and flags overlaps
// and area mismatch.
export function validatePlot(points: LngLat[], opts: ValidateOptions): PlotValidation {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const cleaned = dedupeConsecutive(points);
  if (cleaned.length < 3) {
    return {
      canSave: false,
      orderedRing: null,
      areaHa: null,
      errors: [{ code: "too_few_points", message: "A plot needs at least 3 corners." }],
      warnings: [],
    };
  }

  // Only corner capture is reordered; traced/walked keep their sequence.
  const ordered = opts.method === "corners" ? autoOrderRing(cleaned) : cleaned;
  const ring = closeRing(ordered);

  if (isSelfIntersecting(ring)) {
    errors.push({
      code: "self_intersecting",
      message: "The boundary crosses itself. Re-check the corners.",
    });
  }

  const areaHa = computeAreaHa(ring);
  if (areaHa <= 0) {
    errors.push({ code: "zero_area", message: "The plot has no area." });
  }

  const ratio = areaDivergence(areaHa, opts.claimedAreaHa);
  const threshold = opts.areaMismatchRatio ?? AREA_MISMATCH_RATIO;
  if (ratio !== null && ratio > threshold) {
    warnings.push({
      code: "area_mismatch",
      message: `Drawn area ${areaHa.toFixed(2)} ha differs from claimed ${opts.claimedAreaHa!.toFixed(
        2,
      )} ha by ${Math.round(ratio * 100)}%.`,
    });
  }

  const overlaps = findOverlaps(ring, opts.existingPlots ?? []);
  if (overlaps.length > 0) {
    warnings.push({
      code: "overlap",
      message: `This boundary overlaps ${overlaps.length} existing plot(s).`,
      overlappedPlotIds: overlaps,
    });
  }

  return {
    canSave: errors.length === 0,
    orderedRing: errors.some((e) => e.code === "self_intersecting") ? null : ring,
    areaHa,
    errors,
    warnings,
  };
}
