"use client";

/** Everything a GROW page needs about the selected plot: the plot list, selection, profile and advice. */
import { useCallback, useEffect, useState } from "react";
import { listPlots } from "../intake/store";
import { getGrowProfile, saveGrowProfile } from "./store";
import { resolvePlotId, setSelectedPlotId, useSelectedPlotId } from "./selection";
import { useGrowPlot, type GrowData } from "./useGrowPlot";
import type { GrowProfile } from "./types";
import type { LocalPlot } from "../intake/types";

export interface GrowSession {
  /** Null while the device store is being read. */
  plots: LocalPlot[] | null;
  plot: LocalPlot | null;
  selectPlot: (id: string) => void;
  /** Always the selected plot's own profile, never the previous plot's. */
  profile: GrowProfile | null;
  profileLoaded: boolean;
  saveProfile: (p: GrowProfile) => void;
  grow: GrowData;
}

/** `paused` holds the advice back, e.g. while the profile form is open. */
export function useGrowSession({ paused = false }: { paused?: boolean } = {}): GrowSession {
  const [plots, setPlots] = useState<LocalPlot[] | null>(null);
  const [loaded, setLoaded] = useState<{ plotId: string; profile: GrowProfile | null } | null>(null);

  useEffect(() => {
    listPlots()
      .then(setPlots)
      .catch(() => setPlots([]));
  }, []);

  const plotId = resolvePlotId(plots ?? [], useSelectedPlotId());

  useEffect(() => {
    if (!plotId) return;
    let cancelled = false;
    getGrowProfile(plotId)
      .catch(() => undefined)
      .then((p) => {
        if (!cancelled) setLoaded({ plotId, profile: p ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [plotId]);

  const profileLoaded = !!plotId && loaded?.plotId === plotId;
  const profile = profileLoaded ? loaded!.profile : null;
  const plot = plots?.find((p) => p.id === plotId) ?? null;
  const grow = useGrowPlot(paused || !profileLoaded ? null : plot, profile);

  const saveProfile = useCallback((p: GrowProfile) => {
    setLoaded({ plotId: p.plotId, profile: p });
    void saveGrowProfile(p).catch(() => {});
  }, []);

  return { plots, plot, selectPlot: setSelectedPlotId, profile, profileLoaded, saveProfile, grow };
}
