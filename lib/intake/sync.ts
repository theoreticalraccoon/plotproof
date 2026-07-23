/**
 * Offline → server sync. Drains the outbox when the device is online.
 *
 * The server write is behind the `SyncTransport` interface. The default is the
 * REAL Supabase transport (lib/intake/supabaseTransport.ts, tables from
 * migration 0002). When Supabase is not configured or nobody is signed in,
 * drains report `unavailable: true` and leave everything queued — there is
 * deliberately no transport that pretends to succeed: a farmer's plot marked
 * "synced" that exists in no server is data loss wearing a green tick.
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

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

let running = false;

export interface DrainResult {
  synced: number;
  failed: number;
  /** True when no server sync exists (Supabase unconfigured or signed out). */
  unavailable?: boolean;
}

/**
 * Drain the outbox. Safe to call often (e.g. on 'online', after each save, on
 * an interval), it no-ops if already running or offline. Deletes items on
 * success and flips the corresponding plot/farmer to 'synced'.
 */
export async function drainOutbox(transport?: SyncTransport): Promise<DrainResult> {
  if (running || !isOnline()) return { synced: 0, failed: 0 };
  if (!transport) {
    const { getSupabaseTransport } = await import("./supabaseTransport");
    const resolved = await getSupabaseTransport();
    if (!resolved) return { synced: 0, failed: 0, unavailable: true };
    transport = resolved;
  }
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
export function startAutoSync(transport?: SyncTransport): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => void drainOutbox(transport);
  window.addEventListener("online", handler);
  // Also try once now, in case we're already online with a backlog.
  void drainOutbox(transport);
  return () => window.removeEventListener("online", handler);
}
