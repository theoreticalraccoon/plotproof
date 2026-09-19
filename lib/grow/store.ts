/** Dexie accessors for the GROW lane. */
import { db } from "../intake/db";
import { guardVwc } from "./sensorGuard";
import type { CachedWeatherDay, ProbeCalibration, SensorReading } from "./growTypes";
import type { DailyWeather, GrowProfile } from "./types";

const CAL_KEY = "plotproof.probeCalibration";

// --- grow profile --------------------------------------------------------

export async function getGrowProfile(plotId: string): Promise<GrowProfile | undefined> {
  return db().growProfiles.get(plotId);
}

export async function saveGrowProfile(profile: GrowProfile): Promise<void> {
  await db().growProfiles.put({ ...profile, updatedAt: new Date().toISOString() });
}

// --- weather cache -------------------------------------------------------

/** Cache a fetched range. */
export async function cacheWeather(plotId: string, days: DailyWeather[], fetchedAt: string): Promise<void> {
  const rows: CachedWeatherDay[] = days.map((d) => ({ ...d, plotId, fetchedAt }));
  await db().weatherCache.bulkPut(rows);
}

/** Read cached weather back, oldest first. */
export async function cachedWeather(plotId: string): Promise<CachedWeatherDay[]> {
  const rows = await db().weatherCache.where("plotId").equals(plotId).toArray();
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// --- sensor readings -----------------------------------------------------

export async function addSensorReadings(readings: SensorReading[]): Promise<void> {
  if (readings.length === 0) return;
  await db().sensorReadings.bulkAdd(readings);
}

/** Most recent readings for a plot, newest first. */
export async function recentSensorReadings(plotId: string, limit = 500): Promise<SensorReading[]> {
  const rows = await db().sensorReadings.where("plotId").equals(plotId).toArray();
  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** The latest calibrated soil-moisture value, or null. */
export async function latestSoilMoisture(plotId: string, maxAgeHours = 24): Promise<number | null> {
  const rows = await recentSensorReadings(plotId, 1);
  const latest = rows[0];
  if (!latest) return null;
  const ageHours = (Date.now() - new Date(latest.at).getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours > maxAgeHours) return null;
  // Guard the VALUE as well as its age.
  return guardVwc(latest.vwc);
}

export async function clearSensorReadings(plotId: string): Promise<void> {
  await db().sensorReadings.where("plotId").equals(plotId).delete();
}

// --- probe calibration --------------------------------------------------- localStorage, not
// Dexie: it is a handful of scalars per plot, it is read on every reading parsed.

function readCalibrations(): Record<string, ProbeCalibration> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CAL_KEY) ?? "{}") as Record<string, ProbeCalibration>;
  } catch {
    return {};
  }
}

export function getCalibration(plotId: string): ProbeCalibration | null {
  return readCalibrations()[plotId] ?? null;
}

export function saveCalibration(cal: ProbeCalibration): void {
  if (typeof localStorage === "undefined") return;
  const all = readCalibrations();
  all[cal.plotId] = cal;
  localStorage.setItem(CAL_KEY, JSON.stringify(all));
}

export function clearCalibration(plotId: string): void {
  if (typeof localStorage === "undefined") return;
  const all = readCalibrations();
  delete all[plotId];
  localStorage.setItem(CAL_KEY, JSON.stringify(all));
}
