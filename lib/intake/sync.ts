/**
 * Offline → server sync. Drains the outbox when the device is online.
 *
 * The actual server write is behind the `SyncTransport` interface. The default
 * `stubTransport` just marks items done after a short delay, so the full queue
 * lifecycle (queued → syncing → synced) is demonstrable with no backend. Swap
 * in a `supabaseTransport` once the migration from SCHEMA.md is applied — no
 * caller changes. (Mirrors the analysis-client stub pattern.)
 */
import { db, type OutboxItem } from "./db";

export interface PushResult {
  /** For media: the uploaded location. Its presence lets us purge the blob. */
  remotePath?: string;
}

export interface SyncTransport {
  /** Push one entity to the server. Throw to signal failure (will retry). */
  push(item: OutboxItem): Promise<PushResult | void>;
}

const MAX_ATTEMPTS = 5;

/**
 * Placeholder transport: pretends to succeed. Returns NO remotePath, so media
 * blobs are kept locally (nothing was really uploaded). The real Supabase
 * transport will upload the blob to Storage and return its path, at which point
 * the blob is purged to reclaim device space (DECISIONS.md D-009).
 */
export const stubTransport: SyncTransport = {
  async push() {
    await new Promise((r) => setTimeout(r, 300));
  },
};

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

let running = false;

/**
 * Drain the outbox. Safe to call often (e.g. on 'online', after each save, on
 * an interval) — it no-ops if already running or offline. Deletes items on
 * success and flips the corresponding plot/farmer to 'synced'.
 */
export async function drainOutbox(
  transport: SyncTransport = stubTransport,
): Promise<{ synced: number; failed: number }> {
  if (running || !isOnline()) return { synced: 0, failed: 0 };
  running = true;
  let synced = 0;
  let failed = 0;
  try {
    const database = db();
    const items = await database.outbox.orderBy("seq").toArray();
    for (const item of items) {
      if (item.seq == null) continue;
      await database.outbox.update(item.seq, { status: "syncing" });
      await setEntitySync(item, "syncing");
      try {
        const result = (await transport.push(item)) ?? {};
        await database.outbox.delete(item.seq);
        await setEntitySync(item, "synced");
        // Reclaim device space: once a photo/signature is actually uploaded,
        // drop the local blob and keep only the remote path.
        if (item.entity === "media" && result.remotePath) {
          await database.media.update(item.entityId, {
            remotePath: result.remotePath,
            blob: undefined,
          });
        }
        synced++;
      } catch (err) {
        failed++;
        const attempts = item.attempts + 1;
        const status = attempts >= MAX_ATTEMPTS ? "error" : "queued";
        await database.outbox.update(item.seq, {
          status,
          attempts,
          lastError: err instanceof Error ? err.message : String(err),
        });
        await setEntitySync(item, status === "error" ? "error" : "queued");
      }
    }
  } finally {
    running = false;
  }
  return { synced, failed };
}

async function setEntitySync(
  item: OutboxItem,
  sync: "queued" | "syncing" | "synced" | "error",
): Promise<void> {
  const database = db();
  switch (item.entity) {
    case "plot":
      await database.plots.update(item.entityId, {
        syncStatus: sync,
        ...(sync === "synced" ? { syncedAt: new Date().toISOString() } : {}),
      });
      break;
    case "media":
      await database.media.update(item.entityId, { syncStatus: sync });
      break;
    case "attestation":
      await database.attestations.update(item.entityId, { syncStatus: sync });
      break;
    // Farmers carry no syncStatus column today; nothing to patch.
  }
}

/** Wire up automatic draining on reconnect. Returns a cleanup function. */
export function startAutoSync(transport: SyncTransport = stubTransport): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => void drainOutbox(transport);
  window.addEventListener("online", handler);
  // Also try once now, in case we're already online with a backlog.
  void drainOutbox(transport);
  return () => window.removeEventListener("online", handler);
}
