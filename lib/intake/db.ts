// On-device database (IndexedDB via Dexie). This is the field source of truth: everything
// persists here the instant it's captured, so a phone dying at plot 30 loses nothing.
import Dexie, { type Table } from "dexie";
import type { LocalAttestation, LocalFarmer, LocalMedia, LocalPlot } from "./types";
import type { GrowProfile } from "../grow/types";
import type { CachedWeatherDay, SensorReading } from "../grow/growTypes";

/** A cached basemap tile, keyed "z/x/y". Pre-downloaded per district. */
export interface CachedTile {
  key: string; // `${z}/${x}/${y}`
  blob: Blob;
  district: string;
  cachedAt: string;
}

/** One pending server operation. Append-only outbox; drained by sync. */
export interface OutboxItem {
  seq?: number; // auto-increment
  entity: "farmer" | "plot" | "attestation" | "media";
  entityId: string;
  op: "upsert";
  status: "queued" | "syncing" | "error";
  attempts: number;
  lastError?: string;
  queuedAt: string;
}

export class IntakeDB extends Dexie {
  farmers!: Table<LocalFarmer, string>;
  plots!: Table<LocalPlot, string>;
  tiles!: Table<CachedTile, string>;
  outbox!: Table<OutboxItem, number>;
  media!: Table<LocalMedia, string>;
  attestations!: Table<LocalAttestation, string>;
  growProfiles!: Table<GrowProfile, string>;
  weatherCache!: Table<CachedWeatherDay, [string, string]>;
  sensorReadings!: Table<SensorReading, number>;

  constructor() {
    super("intake");
    // Only indexed fields are listed; the full object is still stored.
    this.version(1).stores({
      farmers: "id, cooperativeId, membershipNo, fullName",
      plots: "id, farmerId, cooperativeId, status, syncStatus, capturedAt",
      tiles: "key, district",
      outbox: "++seq, entity, entityId, status",
    });
    // v2: attestation layer, photos + signatures + attestation records.
    this.version(2).stores({
      media: "id, plotId, kind, syncStatus",
      attestations: "id, plotId, officerId, syncStatus",
    });
    // v3: the GROW lane.
    this.version(3).stores({
      growProfiles: "plotId, crop",
      // Compound primary key: one row per plot per day, so a re-fetch of an overlapping date
      // range updates in place instead of duplicating.
      weatherCache: "[plotId+date], plotId, date",
      sensorReadings: "++seq, plotId, at",
    });
  }
}

// Lazily-created singleton. Guarded so this module can be imported (but not used) in a
// non-browser context without throwing.
let _db: IntakeDB | null = null;
export function db(): IntakeDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("IntakeDB is only available in the browser.");
  }
  if (!_db) _db = new IntakeDB();
  return _db;
}

// Wipe all account-scoped field data (farmers, plots, attestations, media, and the sync
// outbox).
export async function clearIntakeData(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const d = db();
  await Promise.all([
    d.farmers.clear(),
    d.plots.clear(),
    d.attestations.clear(),
    d.media.clear(),
    d.outbox.clear(),
    // Grow-lane data is account-scoped too: a new account on a shared device must not inherit
    // the previous farmer's crop profile or sensor trace.
    d.growProfiles.clear(),
    d.weatherCache.clear(),
    d.sensorReadings.clear(),
  ]);
}
