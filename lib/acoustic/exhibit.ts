/**
 * Builds the acoustic exhibit for one plot: the events near it, in time order,
 * with distances and a summary. Pure (type-only imports + geo) so it's testable
 * and so the PDF generator can call it with any event set.
 */
import { haversineKm } from "./geo";
import type { AcousticEvent, AcousticExhibit, ExhibitEvent, LatLng } from "./types";

export interface ExhibitOptions {
  /** Radius around the plot to include events from. Default 3 km. */
  radiusKm?: number;
  /** Window start (ISO). Default: no lower bound. */
  since?: string;
  /** devEui → node label, for readable exhibit rows. */
  nodeLabels?: Record<string, string | undefined>;
}

export function buildExhibit(
  events: AcousticEvent[],
  location: LatLng,
  opts: ExhibitOptions = {},
): AcousticExhibit {
  const radiusKm = opts.radiusKm ?? 3;
  const sinceMs = opts.since ? Date.parse(opts.since) : -Infinity;

  const within: ExhibitEvent[] = [];
  for (const e of events) {
    if (Date.parse(e.detectedAt) < sinceMs) continue;
    const distanceKm = haversineKm(location, e.location);
    if (distanceKm > radiusKm) continue;
    within.push({
      detectedAt: e.detectedAt,
      eventClass: e.eventClass,
      confidence: e.confidence,
      distanceKm: Math.round(distanceKm * 1000) / 1000,
      nodeDevEui: e.devEui,
      nodeLabel: opts.nodeLabels?.[e.devEui],
    });
  }
  within.sort((a, b) => a.detectedAt.localeCompare(b.detectedAt));

  return {
    location,
    radiusKm,
    since: opts.since ?? within[0]?.detectedAt ?? new Date(0).toISOString(),
    events: within,
    summary: {
      total: within.length,
      chainsaw: within.filter((e) => e.eventClass === "chainsaw").length,
      heavyVehicle: within.filter((e) => e.eventClass === "heavy_vehicle").length,
      firstAt: within[0]?.detectedAt,
      lastAt: within[within.length - 1]?.detectedAt,
      nodes: new Set(within.map((e) => e.nodeDevEui)).size,
    },
  };
}
