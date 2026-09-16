/**
 * Storage-shaped types for the GROW lane.
 *
 * Split from `types.ts` (which holds the domain/model types) because these are
 * Dexie row shapes: they carry primary keys and cache bookkeeping that the pure
 * model layer must never see. `lib/intake/db.ts` imports only from here.
 */
import type { DailyWeather } from "./types";

/**
 * One cached weather day, scoped to a plot.
 *
 * Primary key is the compound `[plotId+date]`, so re-fetching an overlapping
 * range updates in place rather than accumulating duplicate rows — the cache
 * converges instead of growing.
 */
export interface CachedWeatherDay extends DailyWeather {
  plotId: string;
  /** When this row was fetched, so a stale cache can be recognised as stale. */
  fetchedAt: string;
}

/** Where a soil reading came from. Never inferred — always recorded. */
export type SensorSource = "magicbit" | "simulated";

/**
 * One soil reading from the Magicbit (or the labelled simulator).
 *
 * `raw` is kept alongside the calibrated value on purpose: a capacitive probe's
 * ADC count is the only thing actually measured, and every derived number must
 * stay traceable back to it. If the calibration is later found wrong, the trace
 * can be recomputed instead of thrown away.
 */
export interface SensorReading {
  seq?: number;
  plotId: string;
  /** ISO UTC. */
  at: string;
  /** Raw capacitive ADC count, as the board reported it. */
  raw: number;
  /** Volumetric water content, m³/m³, after two-point calibration. Null until calibrated. */
  vwc: number | null;
  soilTempC: number | null;
  airTempC: number | null;
  rhPct: number | null;
  source: SensorSource;
}

/**
 * Two-point calibration for one probe in one soil.
 *
 * A capacitive soil probe reports an arbitrary ADC count, not moisture. Without
 * these two anchors every downstream number is meaningless, so the UI refuses
 * to show a VWC until both are captured, and says why.
 */
export interface ProbeCalibration {
  plotId: string;
  /** ADC count in dry air — the driest the probe will ever read. */
  dryRaw: number;
  /** ADC count submerged in water — the wettest. */
  wetRaw: number;
  capturedAt: string;
}
