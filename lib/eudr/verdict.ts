/**
 * EUDR deforestation screening for one plot.
 *
 * WHAT THIS IS. A transparent rule over the outputs of three published
 * machine-learning products:
 *
 *   - JRC Global Forest Cover 2020 (v2020.3) — was this land forest on the EUDR
 *     cut-off date?
 *   - Hansen / UMD Global Forest Change (v1.13) — was tree cover lost, and in
 *     which year?
 *   - WRI / Google tree-cover-loss drivers — what most likely caused that loss?
 *
 * WHAT THIS IS NOT. There is no EUDR "certificate": the EU operator files a
 * due-diligence statement, and the regulation asks whether the commodity was
 * produced on land not deforested after 31 December 2020. This screening says
 * how strongly the satellite record supports that, and where it does not, what
 * evidence the officer should go and get. It never says "compliant".
 *
 * WHY NOT A CLASSIFIER OF OUR OWN. This project already built and deleted an
 * in-house deforestation model: there are no ground-truth labels for Sri Lankan
 * plots to train or validate one against, and an unvalidated model would be a
 * confident guess dressed as evidence. The global products above are validated
 * by the teams that publish them. What this file adds is the reasoning that
 * connects them to the EUDR question — including the places they disagree.
 *
 * Pure: no network, no DOM. `test/eudr.test.ts` covers every branch.
 */

export interface ForestStats {
  /** Plot area, from the attested boundary. */
  plotHa: number;
  /** JRC GFC2020: area mapped as forest on the cut-off date. */
  forest2020Ha: number;
  /** Hansen loss in 2021 or later, on land JRC mapped as forest in 2020. */
  lossOnForestAfterCutoffHa: number;
  /** Same, split by year. */
  lossOnForestByYear: Record<string, number>;
  /** Same, split by WRI/Google driver category. */
  lossOnForestByDriver: Record<string, number>;
  /** Hansen loss in 2021 or later anywhere on the plot, forest or not. */
  lossAnyAfterCutoffHa: number;
  /** Of the 2020-forest area, how much GFW maps as a plantation, by type. */
  forestPlantationByType: Record<string, number>;
  /** Dataset versions actually queried, for the record. */
  versions: { jrc: string; hansen: string };
}

export type VerdictLevel = "low" | "review" | "high" | "unknown";

export interface VerdictReason {
  /** i18n key; slots carry the numbers. */
  key: string;
  slots: Record<string, string | number>;
}

export interface Verdict {
  level: VerdictLevel;
  reasons: VerdictReason[];
  /** i18n keys for what the officer should gather next. */
  evidence: string[];
}

/**
 * Loss below this is treated as edge noise, not a finding.
 *
 * Hansen is a 30 m product: one pixel is ~0.09 ha, and a boundary pixel that
 * only grazes the plot is still counted pro rata. Flagging a plot for a fraction
 * of a pixel would make every plot next to a road look like a problem. The floor
 * is the larger of 0.05 ha and 1% of the plot — a SCREENING threshold chosen to
 * separate signal from pixel noise, not a legal one, and the UI says so.
 */
export function lossThresholdHa(plotHa: number): number {
  return Math.max(0.05, 0.01 * plotHa);
}

/** Forest share at or above which the 2020 map needs explaining. */
export const FOREST_SHARE_REVIEW = 0.1;

/**
 * Driver categories that mean the land was turned to farming. After the
 * cut-off, that on 2020 forest is precisely what EUDR calls deforestation.
 */
const CONVERSION_DRIVERS = /agricultur|commodit|shifting|crop/i;
/** Drivers that remove trees without necessarily converting the land. */
const NON_CONVERSION_DRIVERS = /logging|forestry|wildfire|fire|natural|disturb/i;

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

function topKey(m: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [k, v] of Object.entries(m)) if (v > 0 && (best === null || v > m[best])) best = k;
  return best;
}

export function screenPlot(stats: ForestStats | null): Verdict {
  if (!stats || !(stats.plotHa > 0)) {
    return { level: "unknown", reasons: [{ key: "eudr_r_unknown", slots: {} }], evidence: ["eudr_e_retry"] };
  }

  const reasons: VerdictReason[] = [];
  const evidence: string[] = [];
  const threshold = lossThresholdHa(stats.plotHa);
  const forestShare = stats.forest2020Ha / stats.plotHa;
  const plantationHa = Object.values(stats.forestPlantationByType).reduce((a, b) => a + b, 0);

  // 1. Loss after the cut-off on land that WAS forest — the EUDR question itself.
  if (stats.lossOnForestAfterCutoffHa >= threshold) {
    const years = Object.entries(stats.lossOnForestByYear)
      .filter(([, v]) => v > 0)
      .map(([y]) => y)
      .sort();
    reasons.push({
      key: "eudr_r_loss_on_forest",
      slots: {
        ha: r2(stats.lossOnForestAfterCutoffHa),
        pct: pct(stats.lossOnForestAfterCutoffHa, stats.plotHa),
        years: years.join(", "),
      },
    });

    const driver = topKey(stats.lossOnForestByDriver);
    if (driver && CONVERSION_DRIVERS.test(driver)) {
      reasons.push({ key: "eudr_r_driver_conversion", slots: { driver } });
    } else if (driver && NON_CONVERSION_DRIVERS.test(driver)) {
      reasons.push({ key: "eudr_r_driver_non_conversion", slots: { driver } });
    } else if (driver) {
      reasons.push({ key: "eudr_r_driver_other", slots: { driver } });
    }

    evidence.push("eudr_e_dated_imagery", "eudr_e_land_use_records", "eudr_e_operator");
    return { level: "high", reasons, evidence };
  }

  // 2. The plot was mapped as forest on the cut-off date but nothing was lost.
  //    For a tree crop this is very often the crop itself: rubber and other
  //    plantations are closed-canopy trees and are regularly mapped as forest.
  if (forestShare >= FOREST_SHARE_REVIEW) {
    reasons.push({
      key: "eudr_r_forest_2020",
      slots: { pct: pct(stats.forest2020Ha, stats.plotHa), ha: r2(stats.forest2020Ha) },
    });
    if (plantationHa > 0) {
      const type = topKey(stats.forestPlantationByType) ?? "";
      reasons.push({
        key: "eudr_r_plantation_overlap",
        slots: { pct: pct(plantationHa, stats.forest2020Ha), type },
      });
    }
    reasons.push({ key: "eudr_r_no_loss_since", slots: {} });
    evidence.push("eudr_e_planting_records", "eudr_e_dated_imagery");
    return { level: "review", reasons, evidence };
  }

  // 3. No 2020 forest to speak of. Any Hansen loss is on non-forest land — tree
  //    crops being replanted, scattered trees cleared — which is not
  //    deforestation under EUDR's definition. Report the disagreement rather
  //    than hide it.
  reasons.push({ key: "eudr_r_not_forest_2020", slots: { pct: pct(stats.forest2020Ha, stats.plotHa) } });
  if (stats.lossAnyAfterCutoffHa >= threshold) {
    reasons.push({ key: "eudr_r_loss_not_forest", slots: { ha: r1(stats.lossAnyAfterCutoffHa) } });
    evidence.push("eudr_e_planting_records");
  } else {
    reasons.push({ key: "eudr_r_no_loss_since", slots: {} });
  }
  evidence.push("eudr_e_keep_boundary");
  return { level: "low", reasons, evidence };
}

/** Worst level across a consignment's plots — the consignment is as risky as its riskiest plot. */
export function consignmentLevel(levels: VerdictLevel[]): VerdictLevel {
  if (levels.length === 0) return "unknown";
  const order: VerdictLevel[] = ["high", "unknown", "review", "low"];
  return order.find((l) => levels.includes(l)) ?? "unknown";
}
