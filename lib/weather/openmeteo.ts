/**
 * Open-Meteo client — the weather half of the GROW lane.
 *
 * Why Open-Meteo: free, no API key, CORS-open (so it is called straight from the
 * browser with no proxy route of our own), CC-BY, and it serves the exact
 * variables an FAO-56 water balance and a foliar-disease risk model need —
 * including `et0_fao_evapotranspiration`, which saves us implementing
 * Penman-Monteith ourselves and getting it subtly wrong.
 *
 * Two endpoints, because they cover different time ranges:
 *   - forecast API  — past 92 days + 16 days ahead. The day-to-day product.
 *   - archive API   — ERA5 reanalysis back to 1940. Used for the sensor↔grid
 *                     calibration fit and for backtesting risk thresholds.
 *
 * Everything here returns a `WeatherResult`, never throws, and never invents a
 * day. A failed load renders as an honest "weather unavailable", matching the
 * `PriceCard` contract (no artifact → render nothing, never a guess).
 */
// Relative, not "@/…": keeps this module loadable by the plain-Node test runner,
// the same reason lib/compliance/catalog.ts avoids the alias.
import { fetchJson, NetError } from "../net.ts";
import type { DailyWeather, WeatherResult } from "../grow/types.ts";
import { toDailyWeather, type OpenMeteoResponse } from "./derive.ts";

// Re-exported so callers have one weather entry point.
export { deriveLeafWetnessHours, toDailyWeather } from "./derive.ts";
export type { OpenMeteoResponse } from "./derive.ts";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

/**
 * Hourly variables. `relative_humidity_2m` and `precipitation` are what the
 * leaf-wetness estimator runs on, so they are not optional.
 */
const HOURLY = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
  "soil_moisture_0_to_7cm",
  "soil_moisture_7_to_28cm",
  "soil_moisture_28_to_100cm",
  "vapour_pressure_deficit",
].join(",");

const DAILY = [
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "et0_fao_evapotranspiration",
  "sunshine_duration",
].join(",");

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function failureReason(e: unknown): string {
  if (e instanceof NetError) return e.message;
  return "Weather data could not be loaded.";
}

/**
 * The day-to-day load: recent history plus the forecast horizon.
 *
 * `pastDays` defaults to 30 — enough trailing context for a 14-day disease
 * window and a month of water balance, without pulling data we will not draw.
 */
export async function loadRecentWeather(
  latitude: number,
  longitude: number,
  { pastDays = 30, forecastDays = 14 }: { pastDays?: number; forecastDays?: number } = {},
): Promise<WeatherResult> {
  const url =
    `${FORECAST_URL}?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
    `&hourly=${HOURLY}&daily=${DAILY}` +
    `&past_days=${Math.min(pastDays, 92)}&forecast_days=${Math.min(forecastDays, 16)}` +
    `&timezone=auto`;

  try {
    const res = await fetchJson<OpenMeteoResponse>(url, { timeoutMs: 12000, retries: 1 });
    // Anything after today is model forecast, not observation, and the UI marks it.
    const days = toDailyWeather(res, isoDate(new Date()));
    if (days.length === 0) return { kind: "unavailable", reason: "No weather rows returned." };
    return {
      kind: "ok",
      days,
      fetchedAt: new Date().toISOString(),
      latitude: res.latitude,
      longitude: res.longitude,
    };
  } catch (e) {
    return { kind: "unavailable", reason: failureReason(e) };
  }
}

/**
 * ERA5 archive load, for the sensor↔grid calibration fit and risk backtests.
 *
 * Note the reanalysis lag: ERA5 is roughly five days behind real time, so the
 * archive will not return the last few days. Callers that need "now" use
 * `loadRecentWeather`.
 */
export async function loadArchiveWeather(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
): Promise<WeatherResult> {
  const url =
    `${ARCHIVE_URL}?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&hourly=${HOURLY}&daily=${DAILY}&timezone=auto`;

  try {
    const res = await fetchJson<OpenMeteoResponse>(url, { timeoutMs: 20000, retries: 1 });
    // Everything the archive returns is reanalysis of the past: nothing is forecast.
    const days = toDailyWeather(res, endDate);
    if (days.length === 0) return { kind: "unavailable", reason: "No archive rows returned." };
    return {
      kind: "ok",
      days,
      fetchedAt: new Date().toISOString(),
      latitude: res.latitude,
      longitude: res.longitude,
    };
  } catch (e) {
    return { kind: "unavailable", reason: failureReason(e) };
  }
}

/** Attribution, rendered wherever weather-derived numbers appear. */
export const WEATHER_SOURCE = {
  name: "Open-Meteo (ECMWF / ERA5)",
  url: "https://open-meteo.com/",
  license: "CC BY 4.0",
} as const;
