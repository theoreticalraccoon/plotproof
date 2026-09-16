/**
 * Dexie accessors for the GROW lane.
 *
 * Mirrors `lib/intake/store.ts` in posture: browser-only, every write lands
 * immediately, nothing waits for a session to end. It deliberately does NOT
 * queue to the outbox — grow data is advisory and locally recomputable, unlike
 * an attested plot boundary, so putting it in the sync contract would add
 * server surface for no evidentiary gain.
 */
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

/**
 * Cache a fetched range. `bulkPut` against the compound `[plotId+date]` key
 * updates overlapping days in place, so repeatedly loading "the last 30 days"
 * converges on one row per day instead of accumulating.
 */
export async function cacheWeather(plotId: string, days: DailyWeather[], fetchedAt: string): Promise<void> {
  const rows: CachedWeatherDay[] = days.map((d) => ({ ...d, plotId, fetchedAt }));
  await db().weatherCache.bulkPut(rows);
}

/**
 * Read cached weather back, oldest first.
 *
 * This is what makes the grow lane work offline: a farmer who loaded the page
 * in town keeps a usable advisory in the field with no signal. The caller is
 * responsible for telling them how old it is — `fetchedAt` rides on every row
 * precisely so that staleness can be shown rather than silently tolerated.
 */
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

/**
 * The latest calibrated soil-moisture value, or null.
 *
 * Returns null when the newest reading is uncalibrated OR older than
 * `maxAgeHours`. A stale soil reading is worse than none: it would override a
 * correctly-accumulating water balance with yesterday's state. Same staleness
 * posture as `PriceCard`'s three-month price gate.
 */
export async function latestSoilMoisture(plotId: string, maxAgeHours = 24): Promise<number | null> {
  const rows = await recentSensorReadings(plotId, 1);
  const latest = rows[0];
  if (!latest) return null;
  const ageHours = (Date.now() - new Date(latest.at).getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours > maxAgeHours) return null;
  // Guard the VALUE as well as its age. A miscalibrated probe can emit anything,
  // and computeIrrigation clamps depletion into [0, TAW] — so an absurd reading
  // does not crash, it quietly becomes a confident wrong verdict from the
  // highest tier of the anchoring ladder. A fault must demote, never outrank.
  return guardVwc(latest.vwc);
}

export async function clearSensorReadings(plotId: string): Promise<void> {
  await db().sensorReadings.where("plotId").equals(plotId).delete();
}

// --- probe calibration ---------------------------------------------------
// localStorage, not Dexie: it is a handful of scalars per plot, it is read on
// every reading parsed, and it must be available synchronously in the serial
// read loop without awaiting IndexedDB.

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
