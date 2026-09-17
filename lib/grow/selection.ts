"use client";

/**
 * Which plot the GROW lane is currently looking at.
 *
 * WHY THIS EXISTS: `/grow` and `/grow/diagnose` each used to pick their own
 * plot, defaulting to `plots[0]`. A farmer with three plots who selected the
 * second one and then tapped "Check the leaves" landed on the diagnosis page
 * scoped to the FIRST plot — so the leaf assessment was composed against
 * another plot's weather, soil and infection pressure, with nothing on screen
 * to reveal the swap. That is the "leaf image associated with the wrong plot"
 * failure, and it is silent, which makes it the worst kind.
 *
 * Deliberately NOT a new state library and NOT a Dexie table: a UI selection is
 * not a record of anything that happened in a field, so it does not belong in
 * the data spine next to attested boundaries. This is the same
 * useSyncExternalStore + localStorage shape as `lib/i18n/index.ts`, which is
 * the pattern this codebase already uses for "a preference that must survive a
 * reload".
 *
 * The stored id is always re-validated against the plots actually present, so a
 * deleted or synced-away plot degrades to the first available one rather than
 * leaving the page pointed at nothing.
 */
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

/**
 * Resolve a remembered id against the plots that actually exist.
 *
 * Pure, so the rule is testable without a browser: a remembered id wins only if
 * it is still present; otherwise the first plot; and an empty list resolves to
 * null rather than to a fabricated id.
 */
export function resolvePlotId<T extends { id: string }>(
  plots: readonly T[],
  remembered: string | null,
): string | null {
  if (plots.length === 0) return null;
  if (remembered && plots.some((p) => p.id === remembered)) return remembered;
  return plots[0].id;
}
