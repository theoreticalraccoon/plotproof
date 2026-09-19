/** Pure transforms over raw Open-Meteo rows. */
import type { DailyWeather } from "../grow/types.ts";

// Leaf wetness is the controlling variable for foliar fungal infection, and Open-Meteo does not
// serve it, so we estimate it.
export function deriveLeafWetnessHours(
  rhPct: (number | null)[],
  precipMm: (number | null)[],
): number {
  let hours = 0;
  for (let i = 0; i < rhPct.length; i++) {
    const rh = rhPct[i];
    const p = precipMm[i];
    if ((p != null && p > 0) || (rh != null && rh >= 90)) hours++;
  }
  return hours;
}

/** Open-Meteo's soil layers and their depth spans, in metres. */
const SOIL_LAYERS = [
  { key: "soil_moisture_0_to_7cm", top: 0.0, bottom: 0.07 },
  { key: "soil_moisture_7_to_28cm", top: 0.07, bottom: 0.28 },
  { key: "soil_moisture_28_to_100cm", top: 0.28, bottom: 1.0 },
] as const;

/** Depth-weighted mean soil water over [0, rootDepthM]. */
export function rootZoneSoilMoisture(
  layerMeans: Record<string, number | null>,
  rootDepthM: number,
): number | null {
  let weighted = 0;
  let depth = 0;
  for (const layer of SOIL_LAYERS) {
    const overlap = Math.max(0, Math.min(rootDepthM, layer.bottom) - layer.top);
    if (overlap <= 0) continue;
    const v = layerMeans[layer.key];
    if (v == null) continue;
    weighted += v * overlap;
    depth += overlap;
  }
  return depth > 0 ? weighted / depth : null;
}

/** Mean of the non-null entries; 0 when every hour of the day is a gap. */
export function meanDefined(xs: (number | null)[]): number {
  const vals = xs.filter((x): x is number => x != null);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Shape of the bits of the Open-Meteo response we actually read. */
export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    relative_humidity_2m: (number | null)[];
    precipitation: (number | null)[];
    soil_moisture_0_to_7cm: (number | null)[];
    soil_moisture_7_to_28cm?: (number | null)[];
    soil_moisture_28_to_100cm?: (number | null)[];
    vapour_pressure_deficit: (number | null)[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    et0_fao_evapotranspiration: (number | null)[];
    sunshine_duration: (number | null)[];
  };
}

/** Group hourly rows by their local calendar date ("2026-09-16T13:00" → "2026-09-16"). */
export function groupHourlyByDate(h: NonNullable<OpenMeteoResponse["hourly"]>) {
  const byDate = new Map<string, number[]>();
  for (let i = 0; i < h.time.length; i++) {
    const date = h.time[i].slice(0, 10);
    const idx = byDate.get(date);
    if (idx) idx.push(i);
    else byDate.set(date, [i]);
  }
  return byDate;
}

/** Fold the two response blocks into one row per day. */
export function toDailyWeather(res: OpenMeteoResponse, lastObservedDate: string): DailyWeather[] {
  const d = res.daily;
  if (!d) return [];
  const hourlyIdx = res.hourly ? groupHourlyByDate(res.hourly) : new Map<string, number[]>();
  const h = res.hourly;

  return d.time.map((date, i) => {
    const rows = hourlyIdx.get(date) ?? [];
    const pick = <K extends keyof NonNullable<typeof h>>(key: K) =>
      h ? rows.map((r) => (h[key] as (number | null)[])[r]) : [];

    const rh = pick("relative_humidity_2m");
    const precipHourly = pick("precipitation");
    const tMax = d.temperature_2m_max[i] ?? 0;
    const tMin = d.temperature_2m_min[i] ?? 0;

    return {
      date,
      tMinC: tMin,
      tMaxC: tMax,
      tMeanC: h && rows.length ? meanDefined(pick("temperature_2m")) : (tMax + tMin) / 2,
      rhMeanPct: meanDefined(rh),
      precipMm: d.precipitation_sum[i] ?? 0,
      et0Mm: d.et0_fao_evapotranspiration[i] ?? 0,
      // Open-Meteo reports sunshine as seconds; a farmer thinks in hours.
      sunshineHours: (d.sunshine_duration[i] ?? 0) / 3600,
      vpdKpa: meanDefined(pick("vapour_pressure_deficit")),
      soilMoistureM3M3: h && rows.length ? meanDefined(pick("soil_moisture_0_to_7cm")) : null,
      // 1.0 m covers the rooting depth of every crop we model; callers needing a shallower zone
      // can re-blend from the raw layers.
      soilMoistureRootZone:
        h && rows.length
          ? rootZoneSoilMoisture(
              {
                soil_moisture_0_to_7cm: meanDefined(pick("soil_moisture_0_to_7cm")),
                soil_moisture_7_to_28cm: h.soil_moisture_7_to_28cm
                  ? meanDefined(rows.map((r) => h.soil_moisture_7_to_28cm![r]))
                  : null,
                soil_moisture_28_to_100cm: h.soil_moisture_28_to_100cm
                  ? meanDefined(rows.map((r) => h.soil_moisture_28_to_100cm![r]))
                  : null,
              },
              1.0,
            )
          : null,
      leafWetnessHours: deriveLeafWetnessHours(rh, precipHourly),
      isForecast: date > lastObservedDate,
    };
  });
}

