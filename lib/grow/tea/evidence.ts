/**
 * The evidence layer: combine what the photo saw, what the weather implies, and
 * what the soil actually measured — WITHOUT conflating them.
 *
 * The rule this file exists to enforce:
 *
 *   **Environmental evidence never changes the predicted class.**
 *
 * A visual prediction of red rust does not become blister blight because the
 * weather favours blister blight. That would be the model laundering a weather
 * prior through a vision output, and the farmer would have no way to see it
 * happen. When the two disagree, the disagreement is REPORTED, not resolved.
 *
 * Nor is anything averaged. Averaging a CNN probability with an infection-
 * pressure index produces a number with no meaning: they are not commensurable,
 * one is a calibrated posterior over classes and the other is a fuzzy index over
 * weather conditions. Instead each source contributes a labelled statement, and
 * the farmer reads the case rather than a score.
 *
 * Pure: takes plain data, returns plain data, no DOM or network.
 */
import type { DiseaseRisk, IrrigationAdvice } from "../types";
import { teaClassByKey } from "../teaClasses.ts";
import type { EvidenceItem, TeaAdvisory, TeaPrediction } from "./types";

/** Risk bands at or above this count as environmentally favourable. */
const FAVOURABLE_BANDS = new Set(["moderate", "high"]);

export interface EvidenceInput {
  prediction: TeaPrediction;
  /** From lib/grow/risk.ts. Untouched — this module only reads it. */
  risks: DiseaseRisk[];
  /** From lib/grow/irrigation.ts. Untouched. */
  irrigation: IrrigationAdvice | null;
  /** Latest observed date, so weather claims can be stamped. */
  observedThrough: string | null;
}

/**
 * Build the advisory.
 *
 * Order of the returned evidence mirrors the required narrative: what the photo
 * suggests, what conditions suggest, what was observed, and then the action.
 */
export function buildAdvisory(input: EvidenceInput): TeaAdvisory {
  const { prediction, risks, irrigation, observedThrough } = input;
  const evidence: EvidenceItem[] = [];
  let conflict = false;

  // --- 1. IMAGE ---------------------------------------------------------
  if (prediction.state === "confident") {
    evidence.push({
      source: "image",
      stance: "supports",
      messageKey: "tea_ev_image_confident",
      slots: { disease: prediction.displayName, pct: Math.round(prediction.confidence * 100) },
    });
  } else if (prediction.state === "uncertain") {
    evidence.push({
      source: "image",
      stance: "neutral",
      messageKey: "tea_ev_image_uncertain",
      slots: {},
    });
  } else {
    evidence.push({
      source: "image",
      stance: "neutral",
      messageKey: "tea_ev_image_unavailable",
      slots: {},
    });
  }

  // --- 2. ENVIRONMENT ---------------------------------------------------
  // Only fungal pathogens the risk engine actually models get an environmental
  // prior. `riskEngineKey` is null for both pests and for healthy, and null
  // means NO PRIOR EXISTS — not "prior is neutral". Attaching a fungal
  // infection window to a mite prediction would be nonsense dressed as rigour.
  const ranked = [...risks].sort((a, b) => b.score - a.score);
  const topRisk = ranked[0];

  if (prediction.state === "confident") {
    const cls = teaClassByKey(prediction.classKey);
    const riskKey = cls?.riskEngineKey ?? null;

    if (riskKey) {
      const own = risks.find((r) => r.disease === riskKey);
      if (own) {
        const favourable = FAVOURABLE_BANDS.has(own.band);
        evidence.push({
          source: "environment",
          stance: favourable ? "supports" : "tension",
          messageKey: favourable ? "tea_ev_env_supports" : "tea_ev_env_low",
          slots: {
            disease: prediction.displayName,
            band: own.band,
            days: own.favourableDays,
            window: own.windowDays,
          },
        });

        // Disagreement, stated plainly. The class is NOT changed.
        if (!favourable && topRisk && topRisk.disease !== riskKey && FAVOURABLE_BANDS.has(topRisk.band)) {
          conflict = true;
          evidence.push({
            source: "environment",
            stance: "tension",
            messageKey: "tea_ev_env_conflict",
            slots: { seen: prediction.displayName, favoured: topRisk.disease, band: topRisk.band },
          });
        }
      }
    } else if (cls?.kind === "pest") {
      evidence.push({
        source: "environment",
        stance: "neutral",
        messageKey: "tea_ev_env_no_model_pest",
        slots: { disease: prediction.displayName },
      });
    } else if (prediction.classKey === "healthy") {
      // A healthy leaf under high infection pressure is worth saying out loud:
      // it is not a contradiction, but it is a reason to keep checking.
      if (topRisk && FAVOURABLE_BANDS.has(topRisk.band)) {
        evidence.push({
          source: "environment",
          stance: "tension",
          messageKey: "tea_ev_env_healthy_but_pressure",
          slots: { disease: topRisk.disease, band: topRisk.band },
        });
      } else {
        evidence.push({ source: "environment", stance: "supports", messageKey: "tea_ev_env_healthy_calm", slots: {} });
      }
    } else {
      evidence.push({
        source: "environment",
        stance: "neutral",
        messageKey: "tea_ev_env_no_model",
        slots: { disease: prediction.displayName },
      });
    }
  } else if (topRisk) {
    // No usable image verdict: environmental pressure still stands on its own.
    evidence.push({
      source: "environment",
      stance: FAVOURABLE_BANDS.has(topRisk.band) ? "supports" : "neutral",
      messageKey: "tea_ev_env_standalone",
      slots: { disease: topRisk.disease, band: topRisk.band, days: topRisk.favourableDays, window: topRisk.windowDays },
    });
  }

  // --- 3. WEATHER PROVENANCE -------------------------------------------
  // Every environmental claim above rests on a grid estimate, not a station on
  // the farm. Saying so once, attached to the evidence it qualifies.
  if (observedThrough && risks.length > 0) {
    evidence.push({
      source: "weather",
      stance: "observation",
      messageKey: "tea_ev_weather_provenance",
      slots: { date: observedThrough },
    });
  }

  // --- 4. SENSOR / SOIL -------------------------------------------------
  // This is the only genuinely OBSERVED quantity in the whole advisory, so it
  // is labelled as such and never merged into the disease reasoning. Soil water
  // does not diagnose a leaf; it changes what to do about watering.
  if (irrigation) {
    evidence.push({
      source: irrigation.anchorSource === "sensor" ? "sensor" : "weather",
      stance: "observation",
      messageKey:
        irrigation.anchorSource === "sensor"
          ? "tea_ev_soil_measured"
          : irrigation.anchorSource === "grid"
            ? "tea_ev_soil_modelled"
            : "tea_ev_soil_balance",
      slots: { verdict: irrigation.verdict, pct: Math.round((irrigation.reasonSlots.pct as number) ?? 0) },
    });
  }

  // --- 5. ACTION --------------------------------------------------------
  let actionKey: string;
  const actionSlots: Record<string, string | number> = {};
  if (prediction.state === "error") {
    actionKey = "tea_action_error";
  } else if (prediction.state === "uncertain") {
    actionKey = "tea_action_retake";
  } else if (prediction.classKey === "healthy") {
    actionKey = conflict || evidence.some((e) => e.stance === "tension")
      ? "tea_action_healthy_watch"
      : "tea_action_healthy";
  } else if (conflict) {
    actionKey = "tea_action_conflict";
    actionSlots.disease = prediction.displayName;
  } else {
    actionKey = "tea_action_confirm";
    actionSlots.disease = prediction.displayName;
  }

  return { prediction, evidence, conflict, actionKey, actionSlots };
}
