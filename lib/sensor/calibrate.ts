/**
 * Two-point calibration: turning an arbitrary ADC count into a water content.
 *
 * WHAT A CAPACITIVE PROBE ACTUALLY MEASURES: the dielectric permittivity of
 * whatever surrounds it, reported as a raw ADC count on a scale nobody
 * published. The count is meaningless in isolation — two probes of the same
 * model, in the same soil, disagree. So the count has to be bracketed by two
 * references the farmer can actually produce in a field: the probe held in dry
 * air, and the probe submerged in water.
 *
 * WHAT THIS DOES NOT GIVE YOU, stated up front because the number looks more
 * authoritative than it is: air-and-water calibration removes the probe's
 * arbitrary scale, but it does not produce a soil-specific volumetric water
 * content. A proper calibration needs gravimetric samples — oven-dried cores —
 * taken from this soil at several moisture levels. What comes out of here is a
 * probe-linear estimate of VWC, good enough to say "this field is wetter than
 * the regional model thinks" and not good enough to publish. The UI says so,
 * and `lib/grow/sensorGuard.ts` still rejects anything physically impossible.
 *
 * Pure. No DOM, no serial, no storage — so `test/sensor.test.ts` exercises the
 * exact arithmetic that runs in the read loop.
 */
import type { ProbeCalibration } from "../grow/growTypes.ts";
import { ADC_MAX, ADC_MIN } from "./protocol.ts";

/**
 * Minimum ADC distance between the dry and wet anchors for the calibration to
 * mean anything.
 *
 * A capacitive probe swings several hundred counts between air and water. If
 * the two anchors are close together, one of them was captured wrongly — the
 * probe was still wet when "dry" was taken, or it never reached the water — and
 * every reading afterwards is amplified noise: with a spread of 10 counts, one
 * count of jitter moves the answer by 10% VWC. Refusing is the only safe
 * response, because the failure is invisible in the output.
 */
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

/**
 * Is this calibration usable?
 *
 * `inverted` is worth its own case rather than being folded into "bad". A
 * capacitive probe reads HIGHER in air than in water — capacitance rises with
 * water, and these boards output an inverted analogue voltage. If wet > dry the
 * two captures were almost certainly swapped, which is a specific mistake with a
 * specific fix ("you captured them the other way round"), not a generic failure.
 */
export function checkCalibration(cal: ProbeCalibration | null): CalibrationCheck {
  if (!cal) return { ok: false, problem: "missing", spread: 0 };

  const { dryRaw, wetRaw } = cal;
  const inRange = (v: number) => Number.isFinite(v) && v >= ADC_MIN && v <= ADC_MAX;
  if (!inRange(dryRaw) || !inRange(wetRaw)) {
    return { ok: false, problem: "out_of_range", spread: 0 };
  }

  const spread = Math.abs(dryRaw - wetRaw);
  if (dryRaw <= wetRaw) return { ok: false, problem: "inverted", spread };
  if (spread < MIN_ANCHOR_SPREAD) return { ok: false, problem: "too_close", spread };

  return { ok: true, problem: null, spread };
}

/**
 * Raw count → volumetric water content, or null if the calibration cannot
 * support the conversion.
 *
 * Linear between the two anchors: dry air is 0 m³/m³ by definition, and free
 * water is 1. A real soil never reaches either — saturated clay tops out near
 * 0.5 — so readings from actual soil land in the middle of the range, which is
 * exactly where a linear interpolation is least wrong.
 *
 * Clamped to [0, 1] rather than extrapolated. A reading drier than the dry
 * anchor means the anchor was captured on a damp probe; extrapolating would
 * report a negative water content, which is not a dry soil, it is a broken
 * calibration. Clamping keeps it at the physical edge and lets the guard and the
 * UI handle the rest.
 */
export function rawToVwc(raw: number, cal: ProbeCalibration | null): number | null {
  const check = checkCalibration(cal);
  if (!check.ok || !cal) return null;
  if (!Number.isFinite(raw)) return null;

  const fraction = (cal.dryRaw - raw) / (cal.dryRaw - cal.wetRaw);
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.round(clamped * 10_000) / 10_000;
}

/**
 * Median of the last n raw counts.
 *
 * Used when capturing an anchor rather than taking a single sample. A capacitive
 * probe jitters by tens of counts and will occasionally spike; the median
 * ignores the spike where a mean would bake it permanently into every reading
 * that follows. An anchor is captured once and lived with, so it is worth the
 * few seconds.
 */
export function medianRaw(samples: readonly number[]): number | null {
  const valid = samples.filter((s) => Number.isFinite(s)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1 ? valid[mid] : Math.round((valid[mid - 1] + valid[mid]) / 2);
}

/**
 * How far the probe disagrees with the weather model's root-zone estimate.
 *
 * Not a correction and not applied to anything — the anchoring ladder already
 * prefers the probe outright when one is present. This is shown to the farmer
 * as a single honest sentence: the grid said one thing, your soil said another,
 * here is the size of the difference. That gap is the entire argument for
 * putting a probe in the ground, and it is worth seeing rather than silently
 * benefiting from.
 */
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
