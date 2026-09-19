/** Global Forest Watch Data API: the per-plot zonal statistics behind the EUDR screening. */
import type { ForestStats } from "./verdict.ts";

export const GFW_BASE = "https://data-api.globalforestwatch.org";
export const JRC = { dataset: "jrc_global_forest_cover", version: "v2020.3" } as const;
export const HANSEN = { dataset: "umd_tree_cover_loss", version: "v1.13" } as const;

/** EUDR cut-off: 31 December 2020. Loss counts from the first year after it. */
export const FIRST_YEAR_AFTER_CUTOFF = 2021;

// `umd_tree_cover_loss__year` as a raster code: 1 = 2001 … 25 = 2025, per the values table the
// Data API publishes for the field.
const LOSS_YEAR_CODE_BASE = 2000;
const FIRST_CODE_AFTER_CUTOFF = FIRST_YEAR_AFTER_CUTOFF - LOSS_YEAR_CODE_BASE;

/** WRI/Google DeepMind drivers of tree cover loss, 1 km (Sims et al. 2025), classification band. */
export const DRIVER_NAMES: Record<number, string> = {
  1: "Permanent agriculture",
  2: "Hard commodities",
  3: "Shifting cultivation",
  4: "Logging",
  5: "Wildfire",
  6: "Settlements and infrastructure",
  7: "Other natural disturbances",
};

/** `gfw_plantations__type`, per the values table the Data API publishes. */
export const PLANTATION_TYPES: Record<number, string> = {
  1: "Fruit",
  2: "Fruit mix",
  3: "Oil palm",
  4: "Oil palm mix",
  5: "Other",
  6: "Other mix",
  7: "Recently cleared",
  8: "Rubber",
  9: "Rubber mix",
  10: "Unknown",
  11: "Wood fiber / timber",
  12: "Wood fiber / timber mix",
};

export type LngLat = [number, number];

export interface GfwQuery {
  dataset: string;
  version: string;
  sql: string;
}

export interface PlotQueries {
  forestTotal: GfwQuery;
  lossOnForest: GfwQuery;
  lossDrivers: GfwQuery;
  plantation: GfwQuery;
  hansen: GfwQuery;
}

export function plotQueries(): PlotQueries {
  // Through JRC the loss year is a code (21 = 2021); through Hansen it is a year.
  const sinceCode = `umd_tree_cover_loss__year >= ${FIRST_CODE_AFTER_CUTOFF}`;
  const sinceYear = `umd_tree_cover_loss__year >= ${FIRST_YEAR_AFTER_CUTOFF}`;
  return {
    forestTotal: { ...JRC, sql: "SELECT SUM(area__ha) FROM results" },
    lossOnForest: {
      ...JRC,
      sql:
        `SELECT umd_tree_cover_loss__year, SUM(area__ha) FROM results ` +
        `WHERE ${sinceCode} GROUP BY umd_tree_cover_loss__year`,
    },
    lossDrivers: {
      ...JRC,
      sql:
        `SELECT wri_google_tree_cover_loss_drivers__category, SUM(area__ha) FROM results ` +
        `WHERE ${sinceCode} GROUP BY wri_google_tree_cover_loss_drivers__category`,
    },
    plantation: {
      ...JRC,
      sql: "SELECT gfw_plantations__type, SUM(area__ha) FROM results GROUP BY gfw_plantations__type",
    },
    hansen: {
      ...HANSEN,
      sql:
        `SELECT umd_tree_cover_loss__year, SUM(area__ha) FROM results ` +
        `WHERE ${sinceYear} GROUP BY umd_tree_cover_loss__year`,
    },
  };
}

export function queryUrl(q: GfwQuery): string {
  return `${GFW_BASE}/dataset/${q.dataset}/${q.version}/query/json`;
}

// --- geometry guards -----------------------------------------------------------

/** Sri Lanka's land extent with a margin. */
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
  // The aggregate column is named after the expression; accept the spellings the API has used
  // rather than trusting one.
  const v = r["area__ha"] ?? r["sum"] ?? r["SUM(area__ha)"] ?? r["sum_area__ha"];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** A loss year from either form: a code (1-99, meaning 2001-2099) or a year. */
const yearOf = (r: Row): number | null => {
  const v = r["umd_tree_cover_loss__year"];
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 100) return LOSS_YEAR_CODE_BASE + n;
  return n > 1990 ? n : null;
};

/** A coded category as its published name; a name passes through unchanged. */
function decode(v: unknown, table: Record<number, string>, what: string): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return table[v] ?? `${what} code ${v}`;
  return null;
}

const add = (m: Record<string, number>, k: string, v: number) => {
  m[k] = (m[k] ?? 0) + v;
};

export interface PlotRows {
  forestTotal: Row[];
  lossOnForest: Row[];
  lossDrivers: Row[];
  plantation: Row[];
  hansen: Row[];
}

export function statsFromRows(plotHa: number, rows: PlotRows): ForestStats {
  // Zonal area can exceed the polygon area slightly at the edges; never report more forest than
  // there is plot.
  const forest2020Ha = Math.min(
    rows.forestTotal.reduce((n, r) => n + areaOf(r), 0),
    plotHa,
  );

  let lossOnForestAfterCutoffHa = 0;
  const lossOnForestByYear: Record<string, number> = {};
  for (const r of rows.lossOnForest) {
    const y = yearOf(r);
    if (y === null || y < FIRST_YEAR_AFTER_CUTOFF) continue;
    const a = areaOf(r);
    lossOnForestAfterCutoffHa += a;
    add(lossOnForestByYear, String(y), a);
  }

  // Drivers attribute a cause to loss already counted above; they never add to it.
  const lossOnForestByDriver: Record<string, number> = {};
  let attributed = 0;
  for (const r of rows.lossDrivers) {
    const d = decode(r["wri_google_tree_cover_loss_drivers__category"], DRIVER_NAMES, "driver");
    const a = areaOf(r);
    if (d) {
      add(lossOnForestByDriver, d, a);
      attributed += a;
    }
  }
  const unattributed = lossOnForestAfterCutoffHa - attributed;
  if (unattributed > 1e-6) add(lossOnForestByDriver, "unattributed", unattributed);

  const forestPlantationByType: Record<string, number> = {};
  for (const r of rows.plantation) {
    const t = decode(r["gfw_plantations__type"], PLANTATION_TYPES, "plantation type");
    if (t) add(forestPlantationByType, t, areaOf(r));
  }

  let lossAnyAfterCutoffHa = 0;
  for (const r of rows.hansen) {
    const y = yearOf(r);
    if (y !== null && y >= FIRST_YEAR_AFTER_CUTOFF) lossAnyAfterCutoffHa += areaOf(r);
  }

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
