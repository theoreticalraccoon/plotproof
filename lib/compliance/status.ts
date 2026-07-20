/**
 * Per-document status tracking for the farmer's checklist. Persisted in
 * localStorage keyed by the sale intent's identity, so changing the sale
 * (different product/market) starts a fresh checklist while returning to the
 * same sale keeps progress. Same persistence posture as the intent itself
 * (client storage now; a durable per-user record follows auth/schema).
 *
 * Pure helpers (intentKey, progressSummary, cycleStatus) are exported separately
 * so the logic is Node-testable without a DOM.
 */
import type { DocStatus, SaleIntent } from "./types";

const KEY = "plotproof.docStatus";

export type StatusMap = Record<string, DocStatus>;

/** Stable identity for a sale: same product+route+claim = same checklist. */
export function intentKey(i: Pick<SaleIntent, "productId" | "originCountry" | "destination" | "organicClaim">): string {
  return [i.productId, i.originCountry, i.destination, i.organicClaim ? "org" : "std"].join("|");
}

/** Progress over the documents actually required (ignores stale entries). */
export function progressSummary(statuses: StatusMap, requiredDocIds: string[]): { ready: number; total: number } {
  const ready = requiredDocIds.filter((id) => statuses[id] === "ready").length;
  return { ready, total: requiredDocIds.length };
}

/** The "Mark as done" toggle: done <-> back to in-progress. */
export function cycleStatus(current: DocStatus | undefined): DocStatus {
  return current === "ready" ? "in_progress" : "ready";
}

// --- localStorage-backed store (guarded so Node tests can import this module) ---

function readAll(): Record<string, StatusMap> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, StatusMap>;
  } catch {
    return {};
  }
}

export function getStatuses(intent: SaleIntent): StatusMap {
  return readAll()[intentKey(intent)] ?? {};
}

export function setStatus(intent: SaleIntent, documentTypeId: string, status: DocStatus): StatusMap {
  if (typeof localStorage === "undefined") return {};
  const all = readAll();
  const k = intentKey(intent);
  all[k] = { ...(all[k] ?? {}), [documentTypeId]: status };
  localStorage.setItem(KEY, JSON.stringify(all));
  return all[k];
}

/** Called by a generator page on open: a doc the farmer has started isn't "not started". */
export function markInProgress(intent: SaleIntent, documentTypeId: string): void {
  const current = getStatuses(intent)[documentTypeId];
  if (!current || current === "not_started") setStatus(intent, documentTypeId, "in_progress");
}
