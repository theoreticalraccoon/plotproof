/** A plot's forest check: where it is kept, which one counts, when it is stale. Pure except the store. */
import { readJson, writeJson } from "../device/local.ts";
import type { ForestStats } from "./verdict.ts";
import type { Sale } from "../sale/types.ts";

export interface ForestCheck {
  stats: ForestStats;
  at: string;
}

/** Older than this, the check is shown as needing a re-run. GFW loss data updates yearly. */
export const STALE_AFTER_DAYS = 90;

const KEY = "plotproof.eudrChecks.v1";

export function saveCheck(plotId: string, check: ForestCheck): void {
  writeJson(KEY, { ...readJson<Record<string, ForestCheck>>(KEY, {}), [plotId]: check });
}

/**
 * The newest check for a plot, wherever it was run. Sales keep a copy of each attached plot's
 * check, so /sell and the evidence pack agree whichever screen ran it last.
 */
export function latestCheck(plotId: string, sales: readonly Sale[], stored = readJson<Record<string, ForestCheck>>(KEY, {})): ForestCheck | null {
  const found = [stored[plotId], ...sales.map((s) => s.eudrChecks?.[plotId])].filter(
    (c): c is ForestCheck => !!c?.stats && typeof c.at === "string",
  );
  found.sort((a, b) => b.at.localeCompare(a.at));
  return found[0] ?? null;
}

export function isStale(check: ForestCheck, now: Date): boolean {
  const ageDays = (now.getTime() - new Date(check.at).getTime()) / 86_400_000;
  return !Number.isFinite(ageDays) || ageDays > STALE_AFTER_DAYS;
}

/** The i18n key for an error code from the route, or the generic one. */
export function errorKey(code: string): string {
  return `eudr_err_${code}`;
}

/** Calls /api/eudr/assess. Errors come back as the route's error codes, or "offline". */
export async function requestCheck(ring: [number, number][], doFetch: typeof fetch = fetch): Promise<ForestCheck | { error: string }> {
  try {
    const res = await doFetch("/api/eudr/assess", {
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
