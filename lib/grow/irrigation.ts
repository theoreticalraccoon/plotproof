/**
 * FAO-56 soil-water balance → "water today, or don't, and why".
 *
 * This is the deterministic half of the GROW lane. There is no model to train
 * and no dataset to caveat: it is the FAO Irrigation & Drainage Paper 56
 * procedure, implemented directly, with every constant traceable to one of its
 * tables. That is deliberate — a farmer acting on a watering instruction
 * deserves arithmetic they could check, not a black box.
 *
 * Reference: Allen, Pereira, Raes & Smith (1998), "Crop evapotranspiration —
 * Guidelines for computing crop water requirements", FAO Irrigation and
 * Drainage Paper 56. Chapter 8 (the single-coefficient water balance) is what
 * this file implements; table numbers are cited inline.
 *
 * Pure: takes plain data, returns plain data, imports nothing that touches the
 * DOM or the network, so `test/irrigation.test.ts` can run it under plain Node.
 */
import type {
  DailyWeather,
  GrowCrop,
  IrrigationAdvice,
  IrrigationVerdict,
  SoilTexture,
  WaterBalanceDay,
} from "./types";

/**
 * Soil hydraulic properties, FAO-56 Table 19 (typical values by texture class).
 *
 * `fc` = water content at field capacity, `wp` = at permanent wilting point,
 * both m³/m³. Their difference times rooting depth is the total water the crop
 * can ever extract. Deliberately five coarse classes: a smallholder knows their
 * soil is "sandy" or "clay", and a finer classification would be false
 * precision dressed up as rigour.
 */
const SOIL: Record<SoilTexture, { fc: number; wp: number }> = {
  sand: { fc: 0.12, wp: 0.05 },
  sandy_loam: { fc: 0.23, wp: 0.11 },
  loam: { fc: 0.26, wp: 0.12 },
  clay_loam: { fc: 0.31, wp: 0.17 },
  clay: { fc: 0.36, wp: 0.22 },
};

/**
 * Per-crop coefficients.
 *
 * `kc`  — mid-season crop coefficient, FAO-56 Table 12. Tea non-shaded is 1.00;
 *         we use the non-shaded figure because most Sri Lankan smallholder tea
 *         is unshaded, and say so.
 * `p`   — soil-water depletion fraction for no stress, FAO-56 Table 22. Beyond
 *         this fraction of TAW the crop begins to close stomata.
 * `rootDepthM` — effective rooting depth of a mature stand, FAO-56 Table 22.
 *
 * Cinnamon is NOT in FAO-56. Its entry is flagged so the UI can say the figure
 * is an analogue from comparable evergreen tree spices rather than a published
 * coefficient — the same honesty rule the compliance catalog follows.
 */
const CROP: Record<GrowCrop, { kc: number; p: number; rootDepthM: number; fao56: boolean }> = {
  tea: { kc: 1.0, p: 0.4, rootDepthM: 1.0, fao56: true },
  rubber: { kc: 1.0, p: 0.4, rootDepthM: 1.5, fao56: true },
  coconut: { kc: 0.95, p: 0.65, rootDepthM: 1.2, fao56: true },
  cinnamon: { kc: 0.9, p: 0.5, rootDepthM: 0.8, fao56: false },
};

export function cropCoefficients(crop: GrowCrop) {
  return CROP[crop];
}

/**
 * Canopy interception, Gash-style: the canopy has a STORAGE CAPACITY that must
 * fill before any water reaches the ground, and sheds a small further fraction
 * of everything beyond it.
 *
 * Two earlier attempts were each wrong in one direction, and both were caught
 * rather than assumed:
 *
 *  1. A flat 2 mm/day subtraction. Live Nuwara Eliya weather exposed it: it
 *     zeroed nearly every light-rain day and drove the balance to "water soon"
 *     on a plot whose own soil-moisture data said it was saturated. Frequent
 *     light rain is the NORMAL case in up-country tea, not an edge case.
 *  2. A pure proportional fraction. That fixed the first bug but created the
 *     opposite one — it credited 1.02 mm of a 1.5 mm drizzle to the root zone,
 *     when physically a dry canopy absorbs a shower that small almost entirely.
 *
 * Storage-then-fraction is the standard formulation and gets both ends right.
 */
const CANOPY_STORAGE_MM = 1.2;
const SPLASH_FRACTION = 0.1;

/** Fraction of throughfall lost to runoff on sloping smallholder land. */
const RUNOFF_FRACTION = 0.15;

/**
 * Rain that actually reaches the root zone.
 *
 * FAO-56 chapter 8 treats runoff and deep percolation explicitly; we collapse
 * them into two coefficients because a smallholder has no way to measure
 * either. The balance is anchored to observed soil moisture where available
 * (see `computeIrrigation`), which is what keeps this simplification from
 * accumulating into a wrong answer over a long dry-down.
 */
export function effectiveRain(precipMm: number): number {
  if (precipMm <= 0) return 0;
  const stored = Math.min(precipMm, CANOPY_STORAGE_MM);
  const beyond = Math.max(0, precipMm - CANOPY_STORAGE_MM);
  const throughfall = beyond * (1 - SPLASH_FRACTION);
  void stored; // the stored depth evaporates; it never reaches the root zone
  return throughfall * (1 - RUNOFF_FRACTION);
}

/**
 * FAO-56 Equation 83: the tabulated depletion fraction `p` assumes ETc ≈ 5
 * mm/day and must be adjusted for the actual demand. In humid low-demand
 * conditions the crop tolerates more depletion; under high demand, less.
 */
export function adjustDepletionFraction(pTable: number, etcMmPerDay: number): number {
  const adjusted = pTable + 0.04 * (5 - etcMmPerDay);
  return Math.min(0.8, Math.max(0.1, adjusted));
}

export interface IrrigationInput {
  days: DailyWeather[];
  crop: GrowCrop;
  soilTexture: SoilTexture;
  /** Plot area, hectares — turns a depth in mm into litres the farmer can act on. */
  areaHa: number;
  /** Overrides the per-crop default (e.g. a young stand with shallower roots). */
  rootDepthM?: number;
  /**
   * Measured volumetric soil water (m³/m³) for the most recent day, from the
   * Magicbit after calibration. When present it RESETS the modelled depletion
   * rather than merely nudging it: a direct measurement of the state variable
   * beats an accumulated model estimate, and accumulation is where a water
   * balance drifts.
   */
  measuredSoilMoisture?: number | null;
}

/**
 * Run the balance and produce an instruction.
 *
 * The balance runs forward over whatever days it is given; depletion starts at
 * field capacity (0 mm depleted). That start assumption matters less the longer
 * the series, because rainfall repeatedly re-saturates the profile and the
 * clamp at 0 discards the memory — which is why the caller passes ~30 days of
 * trailing weather rather than 3.
 */
export function computeIrrigation(input: IrrigationInput): IrrigationAdvice {
  const { days, crop, soilTexture, areaHa } = input;
  const c = CROP[crop];
  const soil = SOIL[soilTexture];
  const rootDepth = input.rootDepthM ?? c.rootDepthM;

  // TAW = 1000 × (θFC − θWP) × Zr   [FAO-56 Eq. 82], mm over the root zone.
  const tawMm = 1000 * (soil.fc - soil.wp) * rootDepth;

  const observed = days.filter((d) => !d.isForecast);
  const series = observed.length > 0 ? observed : days;

  const meanEtc = series.length
    ? (series.reduce((a, d) => a + d.et0Mm, 0) / series.length) * c.kc
    : 0;
  const pAdj = adjustDepletionFraction(c.p, meanEtc);
  const rawMm = pAdj * tawMm;

  const balance: WaterBalanceDay[] = [];
  let depletion = 0;

  for (const d of series) {
    const etcMm = d.et0Mm * c.kc;
    const rain = effectiveRain(d.precipMm);
    // Dr,i = Dr,i-1 − Peff + ETc   [FAO-56 Eq. 85], clamped: below 0 is deep
    // percolation (water the root zone cannot hold), above TAW is impossible.
    depletion = Math.min(tawMm, Math.max(0, depletion - rain + etcMm));
    balance.push({
      date: d.date,
      etcMm: round1(etcMm),
      effectiveRainMm: round1(rain),
      depletionMm: round1(depletion),
      depletionFraction: tawMm > 0 ? round2(depletion / tawMm) : 0,
    });
  }

  /*
   * Anchoring. An OBSERVATION of the state beats an INTEGRATION toward it,
   * because a running balance accumulates every coefficient error it contains
   * and never forgets them. So the final soil state comes from the best
   * evidence available, in strict order:
   *
   *   1. sensor  — a calibrated probe in this plot's soil. Unbeatable.
   *   2. grid    — Open-Meteo's land-surface model, depth-blended over the root
   *                zone. Not a measurement, but a far better-calibrated model
   *                than this file, assimilating satellite and station data.
   *   3. balance — the accumulation above, used only when neither exists.
   *
   * Tier 2 is why this is worth doing at all: without it the balance drifted to
   * "water soon" on a saturated up-country plot. Tier 1 is what the Magicbit
   * buys — it replaces a regional model estimate with this field's real state,
   * and the UI shows which tier produced the answer.
   */
  const vwcToDepletion = (vwc: number) =>
    Math.min(tawMm, Math.max(0, 1000 * (soil.fc - vwc) * rootDepth));

  let anchorSource: "sensor" | "grid" | "balance" = "balance";
  const measured = input.measuredSoilMoisture;
  const gridVwc = series.length ? series[series.length - 1].soilMoistureRootZone : null;

  if (measured != null && Number.isFinite(measured)) {
    depletion = vwcToDepletion(measured);
    anchorSource = "sensor";
  } else if (gridVwc != null && Number.isFinite(gridVwc)) {
    depletion = vwcToDepletion(gridVwc);
    anchorSource = "grid";
  }

  if (anchorSource !== "balance" && balance.length > 0) {
    balance[balance.length - 1] = {
      ...balance[balance.length - 1],
      depletionMm: round1(depletion),
      depletionFraction: tawMm > 0 ? round2(depletion / tawMm) : 0,
    };
  }

  const fraction = tawMm > 0 ? depletion / tawMm : 0;
  const recentRain = series.slice(-3).reduce((a, d) => a + d.precipMm, 0);

  let verdict: IrrigationVerdict;
  let reasonKey: string;
  const reasonSlots: Record<string, string | number> = {
    depletion: Math.round(depletion),
    taw: Math.round(tawMm),
    raw: Math.round(rawMm),
    rain: Math.round(recentRain),
    pct: Math.round(fraction * 100),
  };

  if (depletion <= 0.5 && recentRain > 60) {
    // Saturated profile plus heavy recent rain: the risk is root disease, not drought.
    verdict = "waterlogged";
    reasonKey = "irrigation_reason_waterlogged";
  } else if (depletion >= rawMm) {
    verdict = "water_now";
    reasonKey = "irrigation_reason_water_now";
  } else if (depletion >= 0.75 * rawMm) {
    verdict = "water_soon";
    reasonKey = "irrigation_reason_water_soon";
  } else {
    verdict = "no_action";
    reasonKey = "irrigation_reason_no_action";
  }

  // Refill to field capacity. 1 mm over 1 ha = 10,000 litres.
  const recommendedMm = verdict === "water_now" || verdict === "water_soon" ? round1(depletion) : 0;

  return {
    verdict,
    reasonKey,
    reasonSlots,
    recommendedMm,
    recommendedLitres: Math.round(recommendedMm * areaHa * 10_000),
    tawMm: round1(tawMm),
    rawMm: round1(rawMm),
    balance,
    anchorSource,
    sensorCorrected: anchorSource === "sensor",
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Cited on screen wherever an irrigation number appears. */
export const IRRIGATION_SOURCE = {
  name: "FAO Irrigation & Drainage Paper 56 (Allen et al., 1998)",
  url: "https://www.fao.org/4/x0490e/x0490e00.htm",
  tables: "Table 12 (Kc), Table 19 (soil water), Table 22 (rooting depth, p)",
} as const;
