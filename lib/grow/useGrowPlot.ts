"use client";

/** Weather, irrigation and disease pressure for one plot, cache first, then the network. */
import { useCallback, useEffect, useState } from "react";
import { loadRecentWeather } from "../weather/openmeteo";
import { plotCentre } from "../intake/geometry";
import { MAX_CACHE_AGE_DAYS, adviceFor, usableCache } from "./plotAdvice";
import { cacheWeather, cachedWeather, latestSoilMoisture } from "./store";
import type { DailyWeather, DiseaseRisk, GrowProfile, IrrigationAdvice } from "./types";
import type { LocalPlot } from "../intake/types";

export type GrowState = "loading" | "ready" | "unavailable";

export interface GrowData {
  state: GrowState;
  days: DailyWeather[];
  irrigation: IrrigationAdvice | null;
  risks: DiseaseRisk[];
  /** Set when the rows on screen came from cache rather than the network. */
  cachedAt: string | null;
  /** Latest observed date, so the UI can stamp "observed through …". */
  observedThrough: string | null;
  /** The calibrated probe reading the water balance is anchored to, if any. */
  soilMoisture: number | null;
  reason: string | null;
  refresh: () => void;
}

interface Loaded {
  plotId: string;
  state: GrowState;
  days: DailyWeather[];
  cachedAt: string | null;
  soilMoisture: number | null;
  reason: string | null;
}

const EMPTY: Omit<Loaded, "plotId"> = { state: "loading", days: [], cachedAt: null, soilMoisture: null, reason: null };

export function useGrowPlot(plot: LocalPlot | null, profile: GrowProfile | null): GrowData {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!plot) return;
    let cancelled = false;
    const set = (patch: Partial<Loaded>) => {
      if (!cancelled) setLoaded((prev) => ({ ...EMPTY, ...(prev?.plotId === plot.id ? prev : {}), ...patch, plotId: plot.id }));
    };

    (async () => {
      set({ state: "loading", reason: null });
      // A calibrated reading within the last day beats the modelled estimate.
      set({ soilMoisture: await latestSoilMoisture(plot.id).catch(() => null) });

      const raw = await cachedWeather(plot.id).catch(() => []);
      const cache = usableCache(raw, new Date());
      if (cache.rows.length > 0) set({ days: cache.rows, cachedAt: cache.fetchedAt, state: "ready" });

      const centre = plotCentre(plot.ring);
      if (!centre) {
        if (cache.rows.length === 0) {
          set({ state: "unavailable", reason: "This plot has no usable boundary, so we cannot locate it on the weather grid." });
        }
        return;
      }

      const res = await loadRecentWeather(centre.lat, centre.lng);
      if (cancelled) return;
      if (res.kind === "ok") {
        set({ days: res.days, cachedAt: null, state: "ready" });
        void cacheWeather(plot.id, res.days, res.fetchedAt).catch(() => {});
      } else if (cache.rows.length === 0) {
        set({
          state: "unavailable",
          reason:
            raw.length > 0
              ? `${res.reason} Saved weather for this plot is more than ${MAX_CACHE_AGE_DAYS} days old, so it is not being used.`
              : res.reason,
        });
      }
      // A failed refresh over a good cache leaves the cache on screen, stamped with its age.
    })();

    return () => {
      cancelled = true;
    };
  }, [plot, nonce]);

  // Never show one plot's weather against another, not even for the frame before the effect runs.
  const cur = loaded && plot && loaded.plotId === plot.id ? loaded : { ...EMPTY, plotId: "" };
  const observed = cur.days.filter((d) => !d.isForecast);
  const { irrigation, risks } = adviceFor({
    days: cur.days,
    profile,
    areaHa: plot?.computedAreaHa ?? 0,
    soilMoisture: cur.soilMoisture,
  });

  return {
    state: cur.state,
    days: cur.days,
    irrigation,
    risks,
    cachedAt: cur.cachedAt,
    observedThrough: observed.length ? observed[observed.length - 1].date : null,
    soilMoisture: cur.soilMoisture,
    reason: cur.reason,
    refresh,
  };
}
