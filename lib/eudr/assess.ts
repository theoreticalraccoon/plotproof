/** Forest statistics for one plot boundary from the GFW Data API. Fetch is passed in, so tests can fake GFW. */
import { computeAreaHa } from "../intake/geometry.ts";
import { MAX_PLOT_HA, checkRing, plotQueries, queryUrl, rowsOf, statsFromRows, type GfwQuery, type LngLat } from "./gfw.ts";
import type { ForestStats } from "./verdict.ts";

export type AssessResult =
  | { ok: true; stats: ForestStats; at: string }
  | { ok: false; error: string; status: number };

export interface AssessDeps {
  key: string;
  fetch: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

export async function assessPlot(ring: unknown, deps: AssessDeps): Promise<AssessResult> {
  const problem = checkRing(ring);
  if (problem) return { ok: false, error: problem, status: 400 };
  const coords = ring as LngLat[];

  const plotHa = computeAreaHa(coords);
  if (!(plotHa > 0)) return { ok: false, error: "zero_area", status: 400 };
  if (plotHa > MAX_PLOT_HA) return { ok: false, error: "too_large", status: 400 };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 25_000);
  const run = async (q: GfwQuery) => {
    const res = await deps.fetch(queryUrl(q), {
      method: "POST",
      headers: { "x-api-key": deps.key, "Content-Type": "application/json" },
      body: JSON.stringify({ sql: q.sql, geometry: { type: "Polygon", coordinates: [coords] } }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`GFW ${q.dataset} ${res.status}: ${detail.slice(0, 200)}`);
    }
    return rowsOf(await res.json());
  };

  try {
    const q = plotQueries();
    const [forestTotal, lossOnForest, lossDrivers, plantation, hansen] = await Promise.all([
      run(q.forestTotal),
      run(q.lossOnForest),
      run(q.lossDrivers),
      run(q.plantation),
      run(q.hansen),
    ]);
    return {
      ok: true,
      stats: statsFromRows(plotHa, { forestTotal, lossOnForest, lossDrivers, plantation, hansen }),
      at: (deps.now?.() ?? new Date()).toISOString(),
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    console.error("[eudr/assess]", e instanceof Error ? e.message : e);
    return { ok: false, error: aborted ? "timeout" : "upstream_failed", status: 502 };
  } finally {
    clearTimeout(timer);
  }
}
