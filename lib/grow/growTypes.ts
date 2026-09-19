/** Storage-shaped types for the GROW lane. */
import type { DailyWeather } from "./types";

/** One cached weather day, scoped to a plot. */
export interface CachedWeatherDay extends DailyWeather {
  plotId: string;
  /** When this row was fetched, so a stale cache can be recognised as stale. */
  fetchedAt: string;
}

/** Where a soil reading came from. Never inferred, always recorded. */
export type SensorSource = "magicbit" | "simulated";

/** One soil reading from the Magicbit (or the labelled simulator). */
export interface SensorReading {
  seq?: number;
  plotId: string;
  /** ISO UTC. */
  at: string;
  /** Raw capacitive ADC count, as the board reported it. */
  raw: number;
  /** Volumetric water content, m³/m³, after two-point calibration. Null until calibrated. */
  vwc: number | null;
  source: SensorSource;
}

/** Two-point calibration for one probe in one soil. */
export interface ProbeCalibration {
  plotId: string;
  /** ADC count in dry air, the driest the probe will ever read. */
  dryRaw: number;
  /** ADC count submerged in water, the wettest. */
  wetRaw: number;
  capturedAt: string;
}
