"use client";

/** Which plot the GROW lane is currently looking at. */
import { useSyncExternalStore } from "react";
import { readText, writeText } from "../device/local.ts";

const KEY = "plotproof.grow.plotId";
const listeners = new Set<() => void>();

function snapshot(): string | null {
  return typeof localStorage === "undefined" ? null : readText(KEY);
}

/** Server snapshot. Always null so hydration cannot mismatch. */
function serverSnapshot(): string | null {
  return null;
}

export function setSelectedPlotId(id: string | null): void {
  writeText(KEY, id);
  listeners.forEach((fn) => fn());
}

export function useSelectedPlotId(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    serverSnapshot,
  );
}

/** Resolve a remembered id against the plots that actually exist. */
export function resolvePlotId<T extends { id: string }>(
  plots: readonly T[],
  remembered: string | null,
): string | null {
  if (plots.length === 0) return null;
  if (remembered && plots.some((p) => p.id === remembered)) return remembered;
  return plots[0].id;
}
