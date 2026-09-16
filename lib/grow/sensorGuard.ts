/**
 * Plausibility guard for soil-moisture readings.
 *
 * Added by the /grow adversarial audit, which found that a miscalibrated probe
 * could push any number into the water balance. Volumetric water content is a
 * FRACTION of soil volume: outside roughly [0, 0.7] it is not a wet or dry
 * reading, it is a fault. Saturated clay tops out near 0.5; 0.7 leaves headroom
 * for an odd soil without admitting nonsense.
 *
 * Why this matters more than it looks: `computeIrrigation` clamps depletion into
 * [0, TAW], so an absurd reading like 9.9 does not crash or look wrong — it
 * silently becomes "profile full, no action needed" and the farmer is told not
 * to water a dry field, on the authority of the highest tier in the anchoring
 * ladder. A fault must demote to the next tier, never outrank a working one.
 */

/** Widest physically meaningful volumetric water content, m³/m³. */
export const VWC_MIN = 0;
export const VWC_MAX = 0.7;

export function isPlausibleVwc(v: number | null | undefined): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= VWC_MIN && v <= VWC_MAX;
}

/**
 * Pass a reading through, or null it out.
 *
 * Returning null rather than clamping is deliberate: clamping 9.9 to 0.7 would
 * invent a plausible measurement out of a broken one, and the anchoring ladder
 * would still rank it above a working grid estimate. Null demotes it.
 */
export function guardVwc(v: number | null | undefined): number | null {
  return isPlausibleVwc(v) ? (v as number) : null;
}
