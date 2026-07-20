/**
 * Current sale intent, persisted in localStorage so the farmer can move between
 * the guided flow and the document generators without losing their inputs.
 * (Follows the offline-first spirit; a durable per-user record follows the
 * intake persistence pattern once auth/schema land.)
 */
import type { SaleIntent } from "./types";

const KEY = "plotproof.saleIntent";

export function saveIntent(intent: SaleIntent): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(intent));
}

export function loadIntent(): SaleIntent | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SaleIntent;
  } catch {
    return null;
  }
}
