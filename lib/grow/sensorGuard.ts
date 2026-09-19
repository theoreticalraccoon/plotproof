/** Plausibility guard for soil-moisture readings. */

/** Widest physically meaningful volumetric water content, m³/m³. */
export const VWC_MIN = 0;
export const VWC_MAX = 0.7;

export function isPlausibleVwc(v: number | null | undefined): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= VWC_MIN && v <= VWC_MAX;
}

/** Pass a reading through, or null it out. */
export function guardVwc(v: number | null | undefined): number | null {
  return isPlausibleVwc(v) ? (v as number) : null;
}
