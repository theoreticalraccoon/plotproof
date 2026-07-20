/**
 * Device storage budgeting for the offline queue. The attestation photos are
 * the only heavy payload; this module keeps the officer informed and the
 * browser from evicting us. See DECISIONS.md D-009 for the full strategy.
 */
import { db } from "./db";

export interface StorageEstimate {
  usage: number;
  quota: number;
  /** 0..1 fraction of quota used. */
  ratio: number;
}

/** Overall origin storage usage/quota, or null if the API is unavailable. */
export async function estimateStorage(): Promise<StorageEstimate | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota, ratio: quota > 0 ? usage / quota : 0 };
}

/**
 * Ask the browser to keep our IndexedDB from being evicted under storage
 * pressure. Field devices fill up; without this, a full phone could silently
 * drop unsynced plots. Best-effort — returns whether persistence is granted.
 */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
  return navigator.storage.persist();
}

/** Bytes currently held by locally-retained (not-yet-purged) media blobs. */
export async function localMediaBytes(): Promise<{ bytes: number; count: number }> {
  const items = await db().media.toArray();
  let bytes = 0;
  let count = 0;
  for (const m of items) {
    if (m.blob) {
      bytes += m.bytes;
      count++;
    }
  }
  return { bytes, count };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
