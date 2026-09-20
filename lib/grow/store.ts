/** Dexie accessors for the GROW lane. */
import { db } from "../intake/db";
import { readJson, writeJson } from "../device/local";
import { anchorFrom, readingsFromFrames } from "../sensor/readings";
import type { SensorFrame } from "../sensor/protocol";
import type { CachedWeatherDay, ProbeCalibration, SensorReading, SensorSource } from "./growTypes";
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

/** Stores a live trace for a plot, converted and guarded. Returns how many rows were saved. */
export async function recordReadings(
  plotId: string,
  frames: readonly SensorFrame[],
  cal: ProbeCalibration | null,
  source: SensorSource,
): Promise<number> {
  const rows = readingsFromFrames(frames, cal, plotId, source, new Date());
  if (rows.length > 0) await db().sensorReadings.bulkAdd(rows);
  return rows.length;
}

/** Most recent readings for a plot, newest first. */
export async function recentSensorReadings(plotId: string, limit = 500): Promise<SensorReading[]> {
  const rows = await db().sensorReadings.where("plotId").equals(plotId).toArray();
  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** The latest calibrated soil-moisture value, or null. */
export async function latestSoilMoisture(plotId: string, maxAgeHours = 24): Promise<number | null> {
  const [latest] = await recentSensorReadings(plotId, 1);
  return anchorFrom(latest, new Date(), maxAgeHours);
}

export async function clearSensorReadings(plotId: string): Promise<void> {
  await db().sensorReadings.where("plotId").equals(plotId).delete();
}

// --- probe calibration --------------------------------------------------- localStorage, not
// Dexie: it is a handful of scalars per plot, it is read on every reading parsed.

function readCalibrations(): Record<string, ProbeCalibration> {
  return readJson<Record<string, ProbeCalibration>>(CAL_KEY, {});
}

export function getCalibration(plotId: string): ProbeCalibration | null {
  const cal = readCalibrations()[plotId];
  if (!cal) return null;
  // Older saves wrote 0 for an anchor that had not been captured yet.
  return { ...cal, dryRaw: cal.dryRaw || null, wetRaw: cal.wetRaw || null };
}

export function saveCalibration(cal: ProbeCalibration): void {
  writeJson(CAL_KEY, { ...readCalibrations(), [cal.plotId]: cal });
}

export function clearCalibration(plotId: string): void {
  const { [plotId]: _drop, ...rest } = readCalibrations();
  writeJson(CAL_KEY, rest);
}
