/**
 * A Leaflet tile layer that reads tiles from the IndexedDB cache first and
 * falls back to the network. This is what makes the tracing map work with no
 * signal: whatever the officer pre-cached for the district renders offline.
 *
 * Browser-only (imports leaflet). Load via a dynamic() with ssr:false.
 */
import L from "leaflet";
import {
  buildTileUrl,
  cachedTileObjectUrl,
  ESRI_WORLD_IMAGERY,
  type TileCoord,
  type TileProvider,
} from "@/lib/intake/tiles";

export function createOfflineTileLayer(
  provider: TileProvider = ESRI_WORLD_IMAGERY,
): L.GridLayer {
  const OfflineGridLayer = L.GridLayer.extend({
    createTile(this: L.GridLayer, coords: L.Coords, done: L.DoneCallback): HTMLElement {
      const img = document.createElement("img");
      img.setAttribute("role", "presentation");
      img.alt = "";
      const t: TileCoord = { z: coords.z, x: coords.x, y: coords.y };

      const loadFromNetwork = () => {
        img.onload = () => done(undefined, img);
        img.onerror = () => done(new Error("tile fetch failed"), img);
        img.crossOrigin = "";
        img.src = buildTileUrl(provider, t);
      };

      cachedTileObjectUrl(t)
        .then((url) => {
          if (!url) return loadFromNetwork();
          img.onload = () => {
            URL.revokeObjectURL(url);
            done(undefined, img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            loadFromNetwork(); // cached blob unreadable -> try network
          };
          img.src = url;
        })
        .catch(loadFromNetwork);

      return img;
    },
  });

  // `extend` returns an untyped constructor; assert the shape we know it has.
  const Ctor = OfflineGridLayer as unknown as new (o?: L.GridLayerOptions) => L.GridLayer;
  return new Ctor({
    maxZoom: provider.maxZoom,
    attribution: provider.attribution,
  });
}
