/**
 * Global Forest Watch Data API: the per-plot zonal statistics behind the EUDR
 * screening.
 *
 * Server-side only — the API key must never reach a browser. The query and
 * response shapes are kept here as pure functions (`plotQueries`,
 * `statsFromRows`) so the parsing is tested with fixtures and the route handler
 * stays a thin wrapper around `fetch`.
 *
 * Two queries, both against JRC Global Forest Cover 2020 plus one against
 * Hansen:
 *
 *   A. JRC ∩ loss year ∩ driver — every JRC forest pixel in the plot, with the
 *      Hansen loss year and the WRI/Google driver attached. Rows with no loss
 *      year are forest that is still standing; rows from 2021 on are loss on
 *      2020 forest, which is the EUDR question itself.
 *   B. JRC ∩ plantation type — how much of that "forest" GFW maps as a
 *      plantation. For rubber this is the difference between "deforestation
 *      risk" and "the crop was mapped as forest".
 *   C. Hansen alone, 2021 on — loss anywhere on the plot, forest or not, so a
 *      disagreement between the two maps is reported rather than hidden.
 */
import type { ForestStats } from "./verdict.ts";

export const GFW_BASE = "https://data-api.globalforestwatch.org";
export const JRC = { dataset: "jrc_global_forest_cover", version: "v2020.3" } as const;
export const HANSEN = { dataset: "umd_tree_cover_loss", version: "v1.13" } as const;

/** EUDR cut-off: 31 December 2020. Loss counts from the first year after it. */
export const FIRST_YEAR_AFTER_CUTOFF = 2021;

export type LngLat = [number, number];

export interface GfwQuery {
  dataset: string;
  version: string;
  sql: string;
}

export function plotQueries(): { forest: GfwQuery; plantation: GfwQuery; hansen: GfwQuery } {
  return {
    forest: {
      ...JRC,
      sql:
        "SELECT umd_tree_cover_loss__year, wri_google_tree_cover_loss_drivers__category, SUM(area__ha) " +
        "FROM results GROUP BY umd_tree_cover_loss__year, wri_google_tree_cover_loss_drivers__category",
    },
    plantation: {
      ...JRC,
      sql: "SELECT gfw_plantations__type, SUM(area__ha) FROM results GROUP BY gfw_plantations__type",
    },
    hansen: {
      ...HANSEN,
      sql:
        `SELECT umd_tree_cover_loss__year, SUM(area__ha) FROM results ` +
        `WHERE umd_tree_cover_loss__year >= ${FIRST_YEAR_AFTER_CUTOFF} GROUP BY umd_tree_cover_loss__year`,
    },
  };
}

export function queryUrl(q: GfwQuery): string {
  return `${GFW_BASE}/dataset/${q.dataset}/${q.version}/query/json`;
}

// --- geometry guards -----------------------------------------------------------

/**
 * Sri Lanka's land extent with a margin. The endpoint is a proxy to a keyed
 * third-party API; refusing geometry outside the country stops it being used as
 * a free global zonal-statistics service on someone else's quota.
 */
const LK_BBOX = { minLng: 79.4, maxLng: 82.1, minLat: 5.7, maxLat: 10.1 };
export const MAX_VERTICES = 500;
/** A smallholder plot is hectares, not a district. */
export const MAX_PLOT_HA = 500;

export type RingProblem = "too_few_points" | "too_many_points" | "not_closed" | "outside_sri_lanka" | "bad_number";

export function checkRing(ring: unknown): RingProblem | null {
  if (!Array.isArray(ring) || ring.length < 4) return "too_few_points";
  if (ring.length > MAX_VERTICES) return "too_many_points";
  for (const p of ring) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every((n) => typeof n === "number" && Number.isFinite(n))) {
      return "bad_number";
    }
    const [lng, lat] = p as LngLat;
    if (lng < LK_BBOX.minLng || lng > LK_BBOX.maxLng || lat < LK_BBOX.minLat || lat > LK_BBOX.maxLat) {
      return "outside_sri_lanka";
    }
  }
  const [a, z] = [ring[0] as LngLat, ring[ring.length - 1] as LngLat];
  if (a[0] !== z[0] || a[1] !== z[1]) return "not_closed";
  return null;
}

// --- response parsing ------------------------------------------------------------

type Row = Record<string, unknown>;

/** GFW returns `{ data: [...] }`. Anything else is treated as no rows. */
export function rowsOf(body: unknown): Row[] {
  const data = (body as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data.filter((r) => r && typeof r === "object") as Row[]) : [];
}

const areaOf = (r: Row): number => {
  // The aggregate column is named after the expression; accept the spellings
  // the API has used rather than trusting one.
  const v = r["area__ha"] ?? r["sum"] ?? r["SUM(area__ha)"] ?? r["sum_area__ha"];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const yearOf = (r: Row): number | null => {
  const v = r["umd_tree_cover_loss__year"];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 1990 ? n : null;
};

const add = (m: Record<string, number>, k: string, v: number) => {
  m[k] = (m[k] ?? 0) + v;
};

export function statsFromRows(
  plotHa: number,
  forestRows: Row[],
  plantationRows: Row[],
  hansenRows: Row[],
): ForestStats {
  let forest2020Ha = 0;
  let lossOnForestAfterCutoffHa = 0;
  const lossOnForestByYear: Record<string, number> = {};
  const lossOnForestByDriver: Record<string, number> = {};

  for (const r of forestRows) {
    const a = areaOf(r);
    forest2020Ha += a;
    const y = yearOf(r);
    if (y !== null && y >= FIRST_YEAR_AFTER_CUTOFF) {
      lossOnForestAfterCutoffHa += a;
      add(lossOnForestByYear, String(y), a);
      const d = r["wri_google_tree_cover_loss_drivers__category"];
      add(lossOnForestByDriver, typeof d === "string" && d ? d : "unattributed", a);
    }
  }

  const forestPlantationByType: Record<string, number> = {};
  for (const r of plantationRows) {
    const t = r["gfw_plantations__type"];
    // A null type is forest that is NOT a mapped plantation.
    if (typeof t === "string" && t) add(forestPlantationByType, t, areaOf(r));
  }

  let lossAnyAfterCutoffHa = 0;
  for (const r of hansenRows) {
    const y = yearOf(r);
    if (y !== null && y >= FIRST_YEAR_AFTER_CUTOFF) lossAnyAfterCutoffHa += areaOf(r);
  }

  // Zonal area can exceed the polygon area slightly at the edges; never report
  // more forest than there is plot.
  forest2020Ha = Math.min(forest2020Ha, plotHa);

  return {
    plotHa,
    forest2020Ha,
    lossOnForestAfterCutoffHa,
    lossOnForestByYear,
    lossOnForestByDriver,
    lossAnyAfterCutoffHa,
    forestPlantationByType,
    versions: { jrc: `${JRC.dataset} ${JRC.version}`, hansen: `${HANSEN.dataset} ${HANSEN.version}` },
  };
}

/** Map tiles for the plot map. Keyless and public. */
export const TILE_LAYERS = {
  jrc: `https://tiles.globalforestwatch.org/${JRC.dataset}/${JRC.version}/dynamic/{z}/{x}/{y}.png?implementation=default`,
  hansen: `https://tiles.globalforestwatch.org/${HANSEN.dataset}/${HANSEN.version}/dynamic/{z}/{x}/{y}.png`,
} as const;
