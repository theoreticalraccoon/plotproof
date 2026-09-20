/** Soil readings: plausibility, calibration anchors and the rows that get stored. Pure. */
import type { ProbeCalibration, SensorReading, SensorSource } from "../grow/growTypes.ts";
import type { SensorFrame } from "./protocol.ts";
import { medianRaw, rawToVwc } from "./calibrate.ts";

/** Widest physically meaningful volumetric water content, m³/m³. */
export const VWC_MIN = 0;
export const VWC_MAX = 0.7;

/** How many recent frames a calibration anchor is taken from. */
export const ANCHOR_WINDOW = 12;

export function isPlausibleVwc(v: number | null | undefined): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= VWC_MIN && v <= VWC_MAX;
}

/** Pass a reading through, or null it out. */
export function guardVwc(v: number | null | undefined): number | null {
  return isPlausibleVwc(v) ? (v as number) : null;
}

/**
 * Sets the dry or wet anchor from the median of the last few frames. The other anchor is kept,
 * or stays null until it is captured.
 */
export function captureAnchor(
  frames: readonly SensorFrame[],
  which: "dry" | "wet",
  current: ProbeCalibration | null,
  plotId: string,
  now: Date,
): ProbeCalibration | null {
  const median = medianRaw(frames.slice(-ANCHOR_WINDOW).map((f) => f.raw));
  if (median === null) return null;
  return {
    plotId,
    dryRaw: which === "dry" ? median : (current?.dryRaw ?? null),
    wetRaw: which === "wet" ? median : (current?.wetRaw ?? null),
    capturedAt: now.toISOString(),
  };
}

/**
 * The rows a live trace is stored as. Timestamps are spaced one second apart ending at `now`, so a
 * saved trace reads as a trace. Implausible water contents are stored as null, never as a value.
 */
export function readingsFromFrames(
  frames: readonly SensorFrame[],
  cal: ProbeCalibration | null,
  plotId: string,
  source: SensorSource,
  now: Date,
): SensorReading[] {
  const end = now.getTime();
  return frames.map((f, i) => ({
    plotId,
    at: new Date(end - (frames.length - 1 - i) * 1000).toISOString(),
    raw: f.raw,
    vwc: guardVwc(rawToVwc(f.raw, cal)),
    source,
  }));
}

/** The latest reading's water content if it is recent and plausible, else null. */
export function anchorFrom(latest: SensorReading | undefined, now: Date, maxAgeHours = 24): number | null {
  if (!latest) return null;
  const ageHours = (now.getTime() - new Date(latest.at).getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours > maxAgeHours) return null;
  return guardVwc(latest.vwc);
}
