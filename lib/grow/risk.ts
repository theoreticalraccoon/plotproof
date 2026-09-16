/**
 * Environmental infection-risk engine for tea diseases.
 *
 * This is the half of the disease system with **no transfer gap**. The CNN in
 * `lib/grow/cnn.ts` is trained on Assam and Bangladesh imagery and is therefore
 * uncertain on a Sri Lankan estate; this file is computed entirely from *this
 * plot's* weather, so it is exactly as valid in Ratnapura as anywhere else.
 * That asymmetry is the whole argument for fusing them (`lib/grow/fusion.ts`)
 * rather than shipping the classifier alone.
 *
 * What the output means: an infection-PRESSURE index, not a probability of
 * disease. We are saying "conditions over the last N days favour this
 * pathogen", never "your field is 70% infected". Every render of this number
 * states that distinction.
 *
 * Structure follows the rule the deleted satellite engine established and got
 * right: the decision logic lives OUTSIDE any model, in ordinary readable code,
 * because it is the part an agronomist will question and it must be inspectable
 * rather than buried in weights. Persistence is required for the same reason
 * that engine required it — a single wet day must not raise an alarm.
 *
 * Pure. No DOM, no network, Node-testable.
 */
import type { DailyWeather, DiseaseRisk, RiskBand, RiskDriver, TeaDisease } from "./types";

/**
 * Trapezoidal membership bounds `[a, b, c, d]`: favourability rises from 0 at
 * `a` to 1 at `b`, holds at 1 until `c`, and falls back to 0 at `d`. A
 * descending relationship (low sunshine favours blister blight) is expressed by
 * putting the plateau at the low end, not by a separate code path.
 */
type Trapezoid = [number, number, number, number];

function membership(x: number, [a, b, c, d]: Trapezoid): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

export interface DiseaseModel {
  disease: TeaDisease;
  /** Trailing days examined. Set from the pathogen's incubation period. */
  windowDays: number;
  /** Consecutive favourable days that constitute a fully established episode. */
  persistenceDays: number;
  tempC: Trapezoid;
  /** Hours of canopy wetness per day. Gating, not weighted — see below. */
  leafWetnessHours: Trapezoid;
  rhPct: Trapezoid;
  sunshineHours: Trapezoid;
  /** Modulating factors only; must sum to 1. Temperature and wetness are gates. */
  weights: { rh: number; sunshine: number };
  /** Rendered next to the score so the threshold is never anonymous. */
  basis: string;
}

/**
 * The three diseases, with the conditions each needs.
 *
 * BLISTER BLIGHT is the flagship and the best-evidenced. It is the defining
 * disease of up-country Ceylon tea, and the Tea Research Institute of Sri Lanka
 * has long issued advisories on exactly these drivers: prolonged leaf wetness,
 * a cool 18–22 °C optimum, high humidity, and — the characteristic signal —
 * persistently LOW bright sunshine, historically summarised as fewer than about
 * four sunshine hours a day during the monsoon. Incubation runs ~10–12 days,
 * which sets the 14-day window.
 *
 * BROWN BLIGHT and GREY BLIGHT are weak/wound pathogens: warmer optima, and
 * they follow tissue damage (plucking injury, drought stress) rather than
 * driving an epidemic on their own. Their scores are deliberately harder to
 * push high, because an advisory that cries wolf on ubiquitous saprophytes is
 * worse than none.
 */
const MODELS: Record<TeaDisease, DiseaseModel> = {
  blister_blight: {
    disease: "blister_blight",
    windowDays: 14,
    persistenceDays: 5,
    tempC: [12, 17, 23, 28],
    leafWetnessHours: [4, 9, 24, 25],
    rhPct: [70, 83, 100, 101],
    // Descending: 0–3 h of sun is ideal for the pathogen, 7 h suppresses it.
    sunshineHours: [-1, 0, 3, 7],
    weights: { rh: 0.5, sunshine: 0.5 },
    basis:
      "Exobasidium vexans: cool (18–22 °C), prolonged leaf wetness, high humidity and persistently low sunshine; ~10–12 day incubation.",
  },
  brown_blight: {
    disease: "brown_blight",
    windowDays: 10,
    persistenceDays: 4,
    tempC: [18, 24, 29, 34],
    leafWetnessHours: [6, 11, 24, 25],
    rhPct: [72, 85, 100, 101],
    sunshineHours: [-1, 0, 6, 11],
    weights: { rh: 0.7, sunshine: 0.3 },
    basis:
      "Colletotrichum camelliae: warm (25–28 °C) with sustained wetness, typically following stress or plucking injury.",
  },
  grey_blight: {
    disease: "grey_blight",
    windowDays: 10,
    persistenceDays: 4,
    tempC: [20, 25, 30, 35],
    leafWetnessHours: [6, 10, 24, 25],
    rhPct: [72, 85, 100, 101],
    sunshineHours: [-1, 0, 7, 12],
    weights: { rh: 0.7, sunshine: 0.3 },
    basis:
      "Pestalotiopsis theae: warm (25–30 °C), humid, and strongly associated with wounded leaf tissue after plucking.",
  },
};

/** A day at or above this favourability counts as inside the infection window. */
const FAVOURABLE = 0.5;

/**
 * Per-day favourability, 0–1.
 *
 * Leaf wetness and temperature are GATES (they multiply); humidity and sunshine
 * are modulating factors (they average). That split is biological, not
 * cosmetic. Both gates are necessary conditions: without free moisture there is
 * no spore germination, and outside the pathogen's thermal range there is no
 * development — so either one at zero must take the whole day to zero, however
 * favourable everything else looks.
 *
 * This was originally written with temperature as a heavy weighted term, which
 * let blister blight score maximum risk at 28 °C, well past the temperature at
 * which Exobasidium vexans stops developing. `test/risk.test.ts` caught it. The
 * general lesson is worth keeping: a necessary condition must be encoded as a
 * gate, because no weight is ever large enough to stand in for one.
 */
export function dayFavourability(day: DailyWeather, model: DiseaseModel): number {
  const wetness = membership(day.leafWetnessHours, model.leafWetnessHours);
  if (wetness === 0) return 0;
  const temp = membership(day.tMeanC, model.tempC);
  if (temp === 0) return 0;

  const rh = membership(day.rhMeanPct, model.rhPct);
  const sun = membership(day.sunshineHours, model.sunshineHours);
  const w = model.weights;
  const modulating = rh * w.rh + sun * w.sunshine;

  return wetness * temp * modulating;
}

function band(score: number): RiskBand {
  if (score < 0.3) return "low";
  if (score < 0.6) return "moderate";
  return "high";
}

/**
 * Score one disease over the trailing window.
 *
 * Two terms, because they answer different questions: *how much* of the window
 * was favourable, and *was it sustained*. A fortnight of alternating wet and
 * bright days is not the same threat as five consecutive wet overcast ones,
 * even at identical daily averages, and the run-length term is what separates
 * them.
 */
export function assessDisease(days: DailyWeather[], disease: TeaDisease): DiseaseRisk {
  const model = MODELS[disease];
  // Observed weather only: scoring a forecast as if it had happened would turn
  // a projection into a claim, which is the failure mode this project exists to
  // avoid. Forecast days drive the separate "risk ahead" outlook instead.
  const observed = days.filter((d) => !d.isForecast);
  const window = observed.slice(-model.windowDays);

  if (window.length === 0) {
    return {
      disease,
      score: 0,
      band: "low",
      drivers: [],
      favourableDays: 0,
      windowDays: model.windowDays,
    };
  }

  const scores = window.map((d) => dayFavourability(d, model));
  const favourableDays = scores.filter((s) => s >= FAVOURABLE).length;

  let run = 0;
  let maxRun = 0;
  for (const s of scores) {
    run = s >= FAVOURABLE ? run + 1 : 0;
    if (run > maxRun) maxRun = run;
  }

  const coverage = favourableDays / window.length;
  const persistence = Math.min(1, maxRun / model.persistenceDays);
  const score = round2(0.6 * coverage + 0.4 * persistence);

  return {
    disease,
    score,
    band: band(score),
    drivers: buildDrivers(window, model),
    favourableDays,
    windowDays: window.length,
  };
}

/**
 * The "why" line. Reports what the weather actually did, with real measured
 * values, ranked by how much each driver contributed — so the advisory can
 * always answer "why are you telling me this?" with a number the farmer could
 * have observed themselves.
 */
function buildDrivers(window: DailyWeather[], model: DiseaseModel): RiskDriver[] {
  const n = window.length;
  const avg = (f: (d: DailyWeather) => number) => window.reduce((a, d) => a + f(d), 0) / n;

  const wetHours = avg((d) => d.leafWetnessHours);
  const temp = avg((d) => d.tMeanC);
  const rh = avg((d) => d.rhMeanPct);
  const sun = avg((d) => d.sunshineHours);
  const wetDays = window.filter((d) => membership(d.leafWetnessHours, model.leafWetnessHours) > 0.5).length;

  const drivers: RiskDriver[] = [
    {
      key: "risk_driver_leaf_wetness",
      slots: { hours: round1(wetHours), days: wetDays, window: n },
      weight: membership(wetHours, model.leafWetnessHours),
    },
    {
      key: "risk_driver_temperature",
      slots: { temp: round1(temp) },
      // A gate, so its own membership IS its weight — it can veto the day.
      weight: membership(temp, model.tempC),
    },
    {
      key: "risk_driver_humidity",
      slots: { rh: Math.round(rh) },
      weight: membership(rh, model.rhPct) * model.weights.rh,
    },
    {
      key: "risk_driver_sunshine",
      slots: { hours: round1(sun) },
      weight: membership(sun, model.sunshineHours) * model.weights.sunshine,
    },
  ];

  return drivers.filter((d) => d.weight > 0).sort((a, b) => b.weight - a.weight);
}

/** All three diseases, highest risk first — the order the UI should render them. */
export function assessAll(days: DailyWeather[]): DiseaseRisk[] {
  return (Object.keys(MODELS) as TeaDisease[])
    .map((d) => assessDisease(days, d))
    .sort((a, b) => b.score - a.score);
}

/** The agronomic basis for one disease, for the model card and the detail view. */
export function diseaseBasis(disease: TeaDisease): string {
  return MODELS[disease].basis;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Standing caveats, rendered wherever a risk score appears.
 *
 * Written to be genuinely useful rather than defensive — the same instruction
 * the evidence-pack caveats were written under. Stating what the model cannot
 * do is a credibility asset, not a weakness.
 */
export const RISK_CAVEATS = [
  "This is infection pressure from weather, not a diagnosis. It says conditions favour the pathogen, not that your field is infected.",
  "Leaf wetness is estimated from humidity and rainfall, not measured. It under-reads dew on clear up-country nights.",
  "Weather comes from a ~11 km model grid, not from your field. A sensor on the plot corrects the soil half of that; the air half stays a grid estimate.",
  "Cultivar resistance, shade, elevation and recent spraying all change real risk and none of them are inputs here.",
] as const;
