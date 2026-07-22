/**
 * Basemap tile pre-caching for offline field work. Before going out (on wifi),
 * the officer downloads a district's satellite tiles into IndexedDB; in the
 * field, the map reads them from there with no signal.
 *
 * Provider is configuration, not hardcoded per country (PROJECT.md global rule).
 * Default: Esri World Imagery, free, global, no API key. Note the {z}/{y}/{x}
 * order (y before x).
 */
import { db, type CachedTile } from "./db";

export interface TileProvider {
  name: string;
  /** URL template with {z} {x} {y} placeholders. */
  urlTemplate: string;
  maxZoom: number;
  attribution: string;
}

export const ESRI_WORLD_IMAGERY: TileProvider = {
  name: "Esri World Imagery",
  urlTemplate:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  maxZoom: 19,
  attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
};

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export interface LatLngBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function tileKey(t: TileCoord): string {
  return `${t.z}/${t.x}/${t.y}`;
}

export function buildTileUrl(provider: TileProvider, t: TileCoord): string {
  return provider.urlTemplate
    .replace("{z}", String(t.z))
    .replace("{x}", String(t.x))
    .replace("{y}", String(t.y));
}

// --- slippy-map tile math -------------------------------------------------

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z,
  );
}

/** Every tile covering `bounds` across the inclusive zoom range. */
export function tilesForBounds(
  bounds: LatLngBounds,
  minZoom: number,
  maxZoom: number,
): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lonToTileX(bounds.west, z);
    const xMax = lonToTileX(bounds.east, z);
    const yMin = latToTileY(bounds.north, z); // north = smaller y
    const yMax = latToTileY(bounds.south, z);
    for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x++) {
      for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y++) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

export interface CacheProgress {
  done: number;
  total: number;
  failed: number;
}

/**
 * Download and store every tile for a district. Bounded concurrency keeps a 3G
 * link and a mid-range phone from choking. Skips tiles already cached, so it's
 * safe to resume.
 */
export async function cacheDistrict(
  district: string,
  bounds: LatLngBounds,
  minZoom: number,
  maxZoom: number,
  provider: TileProvider = ESRI_WORLD_IMAGERY,
  onProgress?: (p: CacheProgress) => void,
  concurrency = 4,
): Promise<CacheProgress> {
  const coords = tilesForBounds(bounds, minZoom, maxZoom);
  const progress: CacheProgress = { done: 0, total: coords.length, failed: 0 };
  const database = db();

  let cursor = 0;
  async function worker() {
    while (cursor < coords.length) {
      const t = coords[cursor++];
      const key = tileKey(t);
      try {
        const exists = await database.tiles.get(key);
        if (!exists) {
          const res = await fetch(buildTileUrl(provider, t));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const tile: CachedTile = {
            key,
            blob,
            district,
            cachedAt: new Date().toISOString(),
          };
          await database.tiles.put(tile);
        }
      } catch {
        progress.failed++;
      } finally {
        progress.done++;
        onProgress?.({ ...progress });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return progress;
}

/** Object URL for a cached tile, or null if not cached. Caller revokes it. */
export async function cachedTileObjectUrl(t: TileCoord): Promise<string | null> {
  const tile = await db().tiles.get(tileKey(t));
  return tile ? URL.createObjectURL(tile.blob) : null;
}

export async function districtTileCount(district: string): Promise<number> {
  return db().tiles.where("district").equals(district).count();
}
