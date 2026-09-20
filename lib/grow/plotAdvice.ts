/** What one plot's weather, profile and soil reading add up to. Pure, so the gates are testable. */
import { computeIrrigation } from "./irrigation.ts";
import { assessAll } from "./risk.ts";
import type { DailyWeather, DiseaseRisk, GrowProfile, IrrigationAdvice } from "./types.ts";

/** How old cached weather may be before it stops being advice. */
export const MAX_CACHE_AGE_DAYS = 7;

/** Cached rows, if the newest fetch is recent enough to show; otherwise nothing. */
export function usableCache<T extends { fetchedAt: string }>(
  rows: readonly T[],
  now: Date,
): { rows: T[]; fetchedAt: string | null } {
  const freshest = rows.reduce<string | null>((acc, r) => (acc === null || r.fetchedAt > acc ? r.fetchedAt : acc), null);
  if (!freshest) return { rows: [], fetchedAt: null };
  const ageDays = (now.getTime() - new Date(freshest).getTime()) / 86_400_000;
  return Number.isFinite(ageDays) && ageDays <= MAX_CACHE_AGE_DAYS
    ? { rows: [...rows], fetchedAt: freshest }
    : { rows: [], fetchedAt: null };
}

export function adviceFor(input: {
  days: DailyWeather[];
  profile: GrowProfile | null;
  areaHa: number;
  soilMoisture: number | null;
}): { irrigation: IrrigationAdvice | null; risks: DiseaseRisk[] } {
  const { days, profile } = input;
  if (!profile || days.length === 0) return { irrigation: null, risks: [] };
  return {
    irrigation: computeIrrigation({
      days,
      crop: profile.crop,
      soilTexture: profile.soilTexture,
      areaHa: input.areaHa,
      rootDepthM: profile.rootDepthM,
      measuredSoilMoisture: input.soilMoisture,
    }),
    // The disease windows in risk.ts are tea pathogens, so no other crop is scored.
    risks: profile.crop === "tea" ? assessAll(days) : [],
  };
}
