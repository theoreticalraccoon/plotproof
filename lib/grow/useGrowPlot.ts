"use client";

/**
 * Loads everything the GROW page needs for one plot, in one place.
 *
 * Order matters and is deliberate: cached weather renders FIRST, then the
 * network refreshes it. A farmer who opened this page in town and walked into a
 * field with no signal still gets a usable advisory, labelled with the date it
 * was saved — the same offline-first posture as plot capture, applied to
 * advice instead of evidence.
 *
 * Nothing here invents a number. If weather is unavailable and nothing is
 * cached, the hook reports `unavailable` and the page says so; it never falls
 * back to a climatology or a plausible-looking default.
 */
import { useCallback, useEffect, useState } from "react";
import { loadRecentWeather } from "../weather/openmeteo";
import { plotCentre } from "../intake/geometry";
import { computeIrrigation } from "./irrigation";
import { assessAll } from "./risk";
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
  reason: string | null;
  refresh: () => void;
}

export function useGrowPlot(plot: LocalPlot | null, profile: GrowProfile | null): GrowData {
  const [days, setDays] = useState<DailyWeather[]>([]);
  const [state, setState] = useState<GrowState>("loading");
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [soilMoisture, setSoilMoisture] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!plot) return;
    let cancelled = false;

    (async () => {
      setState("loading");
      setReason(null);

      // A calibrated reading within the last day beats the modelled estimate.
      const measured = await latestSoilMoisture(plot.id).catch(() => null);
      if (!cancelled) setSoilMoisture(measured);

      // 1. Cache first, so something renders before the network is consulted.
      const cache = await cachedWeather(plot.id).catch(() => []);
      if (!cancelled && cache.length > 0) {
        setDays(cache);
        setCachedAt(cache[cache.length - 1].fetchedAt);
        setState("ready");
      }

      // 2. Then refresh from the network.
      const centre = plotCentre(plot.ring);
      if (!centre) {
        if (!cancelled && cache.length === 0) {
          setState("unavailable");
          setReason("This plot has no usable boundary, so we cannot locate it on the weather grid.");
        }
        return;
      }

      const res = await loadRecentWeather(centre.lat, centre.lng);
      if (cancelled) return;

      if (res.kind === "ok") {
        setDays(res.days);
        setCachedAt(null);
        setState("ready");
        void cacheWeather(plot.id, res.days, res.fetchedAt).catch(() => {});
      } else if (cache.length === 0) {
        setState("unavailable");
        setReason(res.reason);
      }
      // A failed refresh over a good cache leaves the cache on screen; the
      // `cachedAt` stamp already tells the farmer how old it is.
    })();

    return () => {
      cancelled = true;
    };
  }, [plot, nonce]);

  const observed = days.filter((d) => !d.isForecast);
  const observedThrough = observed.length ? observed[observed.length - 1].date : null;

  const irrigation =
    profile && days.length > 0
      ? computeIrrigation({
          days,
          crop: profile.crop,
          soilTexture: profile.soilTexture,
          areaHa: plot?.computedAreaHa ?? 0,
          rootDepthM: profile.rootDepthM,
          measuredSoilMoisture: soilMoisture,
        })
      : null;

  // Risk scoring is tea-specific: the epidemiological windows in risk.ts are
  // Camellia sinensis pathogens. Other crops get weather and watering, and the
  // page says the disease model does not cover them yet rather than scoring
  // them with the wrong pathogen.
  const risks = profile?.crop === "tea" && days.length > 0 ? assessAll(days) : [];

  return { state, days, irrigation, risks, cachedAt, observedThrough, reason, refresh };
}
