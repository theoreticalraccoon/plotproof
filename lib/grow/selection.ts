"use client";

/** Which plot the GROW lane is currently looking at. */
import { useSyncExternalStore } from "react";

const KEY = "plotproof.grow.plotId";
const listeners = new Set<() => void>();

function snapshot(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    // Private mode, or storage disabled. Selection simply does not persist.
    return null;
  }
}

/** Server snapshot. Always null so hydration cannot mismatch. */
function serverSnapshot(): string | null {
  return null;
}

export function setSelectedPlotId(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch {
    // Non-fatal; the in-memory selection for this page still works.
  }
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
