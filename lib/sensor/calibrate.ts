/** Two-point calibration: turning an arbitrary ADC count into a water content. */
import type { ProbeCalibration } from "../grow/growTypes.ts";
import { ADC_MAX, ADC_MIN } from "./protocol.ts";

/** Minimum ADC distance between the dry and wet anchors for the calibration to mean anything. */
export const MIN_ANCHOR_SPREAD = 150;

export type CalibrationProblem =
  | "missing"
  | "out_of_range"
  | "inverted"
  | "too_close";

export interface CalibrationCheck {
  ok: boolean;
  problem: CalibrationProblem | null;
  /** |dry − wet| in ADC counts. Shown so a bad capture is diagnosable. */
  spread: number;
}

/** Is this calibration usable? */
export function checkCalibration(cal: ProbeCalibration | null): CalibrationCheck {
  if (!cal) return { ok: false, problem: "missing", spread: 0 };

  const { dryRaw, wetRaw } = cal;
  if (dryRaw === null || wetRaw === null) return { ok: false, problem: "missing", spread: 0 };
  const inRange = (v: number) => Number.isFinite(v) && v >= ADC_MIN && v <= ADC_MAX;
  if (!inRange(dryRaw) || !inRange(wetRaw)) {
    return { ok: false, problem: "out_of_range", spread: 0 };
  }

  const spread = Math.abs(dryRaw - wetRaw);
  if (dryRaw <= wetRaw) return { ok: false, problem: "inverted", spread };
  if (spread < MIN_ANCHOR_SPREAD) return { ok: false, problem: "too_close", spread };

  return { ok: true, problem: null, spread };
}

// Raw count → volumetric water content, or null if the calibration cannot support the
// conversion.
export function rawToVwc(raw: number, cal: ProbeCalibration | null): number | null {
  const check = checkCalibration(cal);
  if (!check.ok || !cal) return null;
  if (!Number.isFinite(raw)) return null;

  const dry = cal.dryRaw as number;
  const fraction = (dry - raw) / (dry - (cal.wetRaw as number));
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.round(clamped * 10_000) / 10_000;
}

/** Median of the last n raw counts. */
export function medianRaw(samples: readonly number[]): number | null {
  const valid = samples.filter((s) => Number.isFinite(s)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1 ? valid[mid] : Math.round((valid[mid - 1] + valid[mid]) / 2);
}

/** How far the probe disagrees with the weather model's root-zone estimate. */
export function gridDisagreement(
  probeVwc: number | null,
  gridVwc: number | null,
): { deltaVwc: number; probeIsWetter: boolean } | null {
  if (probeVwc == null || gridVwc == null) return null;
  if (!Number.isFinite(probeVwc) || !Number.isFinite(gridVwc)) return null;
  const delta = probeVwc - gridVwc;
  return {
    deltaVwc: Math.round(Math.abs(delta) * 1000) / 1000,
    probeIsWetter: delta > 0,
  };
}
