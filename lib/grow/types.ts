/**
 * The GROW lane: help a farmer grow an export crop well, before the compliance
 * paperwork ever matters.
 *
 * Design rule, inherited from the compliance lane ("the app never invents law"):
 * **the app never invents agronomy.** Every threshold in this lane is either
 * (a) published FAO-56 / tea-research literature, cited on the type that carries
 * it, or (b) a measured model output shipped with its own model card. Nothing is
 * a number someone felt was about right.
 *
 * The three evidence streams and what each is worth:
 *
 *   weather  →  epidemiological risk   — computed from THIS farm's conditions,
 *                                        so it carries no transfer gap
 *   photo    →  CNN                    — trained on Assam/Bangladesh imagery,
 *                                        so it DOES carry a transfer gap
 *   sensor   →  grid calibration       — corrects the weather grid to this site
 *
 * `lib/grow/fusion.ts` combines the first two; `lib/sensor/calibrate.ts` feeds
 * the third back into the first. Keeping them as separate, individually
 * inspectable stages is deliberate — it is the part an agronomist will question,
 * and it needs to be readable rather than buried in weights.
 */

// --- weather -------------------------------------------------------------

/**
 * One day of weather for one plot, aggregated from Open-Meteo hourly data.
 *
 * `leafWetnessHours` is DERIVED, not served: Open-Meteo has no leaf-wetness
 * variable, and it is the single most important driver of foliar fungal
 * infection. See `deriveLeafWetnessHours` in `lib/weather/openmeteo.ts` for the
 * estimator and its citation.
 */
export interface DailyWeather {
  /** Local calendar date, YYYY-MM-DD (Open-Meteo `timezone=auto`). */
  date: string;
  tMinC: number;
  tMaxC: number;
  tMeanC: number;
  /** Daily mean relative humidity, %. */
  rhMeanPct: number;
  precipMm: number;
  /** FAO-56 reference evapotranspiration, mm/day. Open-Meteo computes this. */
  et0Mm: number;
  /** Bright sunshine, hours. Low sunshine is a blister-blight driver. */
  sunshineHours: number;
  /** Mean daytime vapour-pressure deficit, kPa. */
  vpdKpa: number;
  /** Volumetric soil water content 0–7 cm, m³/m³. Model estimate, not measured. */
  soilMoistureM3M3: number | null;
  /**
   * Depth-weighted mean soil water over the crop's root zone, m³/m³, blended
   * from Open-Meteo's four soil layers. This is a LAND-SURFACE MODEL estimate,
   * not a measurement — but it is a far better-calibrated one than a 20-line
   * water balance accumulating rain and evaporation, so it anchors the balance
   * when no physical sensor is present. See `anchorSource` on IrrigationAdvice.
   */
  soilMoistureRootZone: number | null;
  /** Derived. Hours the canopy was probably wet. See the note above. */
  leafWetnessHours: number;
  /** false once the date passes the last archived/observed day. */
  isForecast: boolean;
}

/** What a weather load produced, including the honest failure cases. */
export type WeatherResult =
  | { kind: "ok"; days: DailyWeather[]; fetchedAt: string; latitude: number; longitude: number }
  | { kind: "unavailable"; reason: string };

// --- the plot's growing profile -----------------------------------------

/**
 * Soil texture classes we support, with the hydraulic properties the FAO-56
 * water balance needs. Deliberately coarse: a farmer knows "clay" or "sandy",
 * and pretending to more precision than that would be false.
 */
export type SoilTexture = "sand" | "sandy_loam" | "loam" | "clay_loam" | "clay";

export type GrowCrop = "tea" | "rubber" | "coconut" | "cinnamon";

/**
 * Per-plot growing context the farmer supplies once. Stored in the Dexie
 * `growProfiles` table keyed by plotId — deliberately NOT folded into
 * `LocalPlot`, so the field-capture record keeps exactly the shape it had when
 * it was attested.
 */
export interface GrowProfile {
  plotId: string;
  crop: GrowCrop;
  soilTexture: SoilTexture;
  /** ISO date the stand was planted, if known. Drives crop stage / Kc. */
  plantedAt?: string;
  /** Effective rooting depth, metres. Defaults per crop when unset. */
  rootDepthM?: number;
  /** Is the plot irrigated at all? Most Sri Lankan smallholder tea is rainfed. */
  irrigated: boolean;
  updatedAt: string;
}

// --- irrigation ----------------------------------------------------------

/** One day of the FAO-56 soil-water balance, kept for the chart and the audit. */
export interface WaterBalanceDay {
  date: string;
  /** Crop evapotranspiration, mm. ETc = ET0 × Kc. */
  etcMm: number;
  /** Rainfall that actually entered the root zone, mm (after runoff losses). */
  effectiveRainMm: number;
  /** Root-zone depletion at end of day, mm. 0 = field capacity. */
  depletionMm: number;
  /** Fraction of total available water used up, 0–1. */
  depletionFraction: number;
}

export type IrrigationVerdict = "no_action" | "water_soon" | "water_now" | "waterlogged";

export interface IrrigationAdvice {
  verdict: IrrigationVerdict;
  /** Plain-language reason, already localised by the caller's `t()`. */
  reasonKey: string;
  reasonSlots: Record<string, string | number>;
  /** mm of water to apply to return the root zone to field capacity. */
  recommendedMm: number;
  /** …expressed as litres over the whole plot, which is what a farmer can act on. */
  recommendedLitres: number;
  /** Total available water in the root zone, mm. */
  tawMm: number;
  /** Readily available water — depletion beyond this starts stressing the crop. */
  rawMm: number;
  balance: WaterBalanceDay[];
  /**
   * Which evidence set the final soil state. An honesty ladder, best first:
   *   "sensor"  — measured on this plot by a calibrated probe
   *   "grid"    — a land-surface model estimate for this area
   *   "balance" — accumulated from rainfall and evaporation only
   * Rendered on screen, because a farmer deciding whether to trust the number
   * should know whether anything actually touched their soil.
   */
  anchorSource: "sensor" | "grid" | "balance";
  /** Convenience for the UI: true when `anchorSource === "sensor"`. */
  sensorCorrected: boolean;
}

// --- disease risk --------------------------------------------------------

export type TeaDisease = "blister_blight" | "brown_blight" | "grey_blight";

export type RiskBand = "low" | "moderate" | "high";

/**
 * Environmental infection risk for one disease on one day.
 *
 * `score` is an infection-pressure index in 0–1, NOT a probability of disease.
 * That distinction is stated wherever it is rendered: we are saying "conditions
 * this week favour the pathogen", not "your field is 0.7 infected".
 */
export interface DiseaseRisk {
  disease: TeaDisease;
  score: number;
  band: RiskBand;
  /** The specific conditions that drove the score, for the "why" line. */
  drivers: RiskDriver[];
  /** How many of the trailing days had conditions inside the infection window. */
  favourableDays: number;
  windowDays: number;
}

export interface RiskDriver {
  /** i18n key describing the driver, e.g. "risk_driver_leaf_wetness". */
  key: string;
  slots: Record<string, string | number>;
  /** Contribution to the score, 0–1, so the UI can rank the explanation. */
  weight: number;
}
