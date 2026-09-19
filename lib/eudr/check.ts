/** Runs the GFW screening for one plot and keeps the latest result per plot on this device. */
import type { ForestStats } from "./verdict";
import type { Sale } from "../sale/types";

export interface ForestCheck {
  stats: ForestStats;
  at: string;
}

const KEY = "plotproof.eudrChecks.v1";

function readAll(): Record<string, ForestCheck> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function saveCheck(plotId: string, check: ForestCheck): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [plotId]: check }));
  } catch {
    // Storage full or blocked: the check still shows until the page closes.
  }
}

/** Newest check for a plot, whether it was run from the pack or from a sale. */
export function latestCheck(plotId: string, sales: Sale[]): ForestCheck | null {
  const found = [readAll()[plotId], ...sales.map((s) => s.eudrChecks?.[plotId])].filter(
    (c): c is ForestCheck => !!c?.stats && typeof c.at === "string",
  );
  found.sort((a, b) => b.at.localeCompare(a.at));
  return found[0] ?? null;
}

/** Calls /api/eudr/assess. Errors come back as the route's error codes, or "offline". */
export async function requestCheck(ring: [number, number][]): Promise<ForestCheck | { error: string }> {
  try {
    const res = await fetch("/api/eudr/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ring }),
    });
    const body = (await res.json().catch(() => ({}))) as { stats?: ForestStats; at?: string; error?: string };
    if (!res.ok || !body.stats) return { error: body.error ?? "upstream_failed" };
    return { stats: body.stats, at: body.at ?? new Date().toISOString() };
  } catch {
    return { error: "offline" };
  }
}
