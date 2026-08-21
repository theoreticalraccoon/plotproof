"use client";

/**
 * The public map. Vanilla Leaflet (browser-only; load via dynamic ssr:false).
 * Satellite imagery + a place-name overlay so a journalist can orient without
 * prior knowledge. Flagged patches are red; clicking one selects it. In "report"
 * mode a click drops a pin to report clearing the map is missing.
 *
 * The map reports its own real state: imagery still loading, imagery that failed
 * to load, and "nothing flagged here" are three different things and a blank
 * dark rectangle looks identical to all of them.
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ESRI_WORLD_IMAGERY } from "@/lib/intake/tiles";

export interface MapFeature {
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: {
    countryCode: string;
    commodity?: string;
    confidence: number;
    centroid: [number, number];
    reports: { confirm: number; dispute: number };
  };
}

interface Props {
  features: MapFeature[];
  selectedId?: string;
  reportMode: boolean;
  pin?: [number, number] | null; // [lng, lat]
  onSelectFeature: (id: string) => void;
  onDropPin: (lngLat: [number, number]) => void;
  /** Shown as a quiet overlay when there is genuinely nothing to draw. Pass
   *  null while the data is still in flight, so an empty map is never described
   *  as empty before we know that it is. */
  emptyHint?: string | null;
}

const PLACES_OVERLAY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

/* Overlay colours are deliberately NOT theme tokens. These sit on satellite
   imagery, which is dark in both themes, so a light-mode --danger (a deep
   maroon) would disappear against canopy. Same reasoning as TraceMap. */
const FLAG_STROKE = "#ef4444";
const FLAG_STROKE_SELECTED = "#facc15";
const PIN_FILL = "#2563eb";

/** Leaflet ships its own light-only chrome. Re-skin just the two controls the
 *  user actually sees so they read as part of the app in dark mode too. */
const CONTROL_CSS = `
.pp-map .leaflet-bar a,
.pp-map .leaflet-control-attribution {
  background: var(--glass-nav);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  color: var(--fg-muted);
  border-color: var(--glass-border);
}
.pp-map .leaflet-bar a:hover { background: var(--bg-1); color: var(--fg); }
.pp-map .leaflet-control-attribution a { color: var(--fg-muted); }
.pp-map .leaflet-container:focus-visible,
.pp-map .leaflet-bar a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;

export default function PublicMap({
  features,
  selectedId,
  reportMode,
  pin,
  onSelectFeature,
  onDropPin,
  emptyHint = null,
}: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const featureLayer = useRef<L.LayerGroup | null>(null);
  const pinLayer = useRef<L.LayerGroup | null>(null);
  const reduced = useRef(false);
  // Keep the latest callbacks/flags without re-initialising the map.
  const cb = useRef({ reportMode, onDropPin });
  cb.current = { reportMode, onDropPin };

  // "loading" only describes the FIRST paint. Re-showing it on every pan would
  // be noise, and tiles arriving during a pan is not something to announce.
  const [tiles, setTiles] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const map = L.map(divRef.current, {
      worldCopyJump: true,
      // Reduced motion has to reach Leaflet's own tweens; they are not CSS
      // transitions, so the global reduce block in globals.css cannot stop them.
      zoomAnimation: !reduced.current,
      fadeAnimation: !reduced.current,
      markerZoomAnimation: !reduced.current,
    }).setView([4, 20], 3);

    const imagery = L.tileLayer(ESRI_WORLD_IMAGERY.urlTemplate, {
      attribution: ESRI_WORLD_IMAGERY.attribution,
      maxZoom: ESRI_WORLD_IMAGERY.maxZoom,
    });
    imagery.on("load", () => setTiles("ready"));
    imagery.on("tileerror", () => setTiles("error"));
    imagery.addTo(map);

    L.tileLayer(PLACES_OVERLAY, { maxZoom: 19, opacity: 0.9 }).addTo(map);
    featureLayer.current = L.layerGroup().addTo(map);
    pinLayer.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (cb.current.reportMode) cb.current.onDropPin([e.latlng.lng, e.latlng.lat]);
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);

    // The side panel sits beside the map on desktop and under it on mobile, so
    // the map box changes size on rotate/resize, not just on window resize.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(divRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw flagged features whenever the data or selection changes.
  useEffect(() => {
    const layer = featureLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const f of features) {
      const selected = f.id === selectedId;
      const poly = L.geoJSON(f.geometry as GeoJSON.Geometry, {
        style: {
          color: selected ? FLAG_STROKE_SELECTED : FLAG_STROKE,
          weight: selected ? 3 : 1.5,
          fillColor: FLAG_STROKE,
          fillOpacity: selected ? 0.45 : 0.35,
        },
      });
      poly.on("click", (e) => {
        L.DomEvent.stopPropagation(e); // don't also drop a pin
        onSelectFeature(f.id);
      });
      poly.addTo(layer);
    }
  }, [features, selectedId, onSelectFeature]);

  // Bring the selection into view when it was chosen from the side list rather
  // than from the map. A selection the user can't see is a dead-end.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const f = features.find((x) => x.id === selectedId);
    if (!f) return;
    const target = L.latLng(f.properties.centroid[1], f.properties.centroid[0]);
    // Already on screen → don't yank the view the user is reading.
    if (map.getBounds().contains(target)) return;
    if (reduced.current) map.setView(target, Math.max(map.getZoom(), 7));
    else map.flyTo(target, Math.max(map.getZoom(), 7), { duration: 0.6 });
  }, [selectedId, features]);

  // Show the report pin.
  useEffect(() => {
    const layer = pinLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (pin) {
      L.circleMarker(L.latLng(pin[1], pin[0]), {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: PIN_FILL,
        fillOpacity: 1,
      })
        .bindTooltip("Your report", { permanent: false })
        .addTo(layer);
    }
  }, [pin]);

  // Cursor hint for report mode.
  useEffect(() => {
    const el = mapRef.current?.getContainer();
    if (el) el.style.cursor = reportMode ? "crosshair" : "";
  }, [reportMode]);

  return (
    <div className="pp-map relative h-full w-full">
      <style>{CONTROL_CSS}</style>
      <div
        ref={divRef}
        className="h-full w-full"
        style={{ minHeight: 320 }}
        role="application"
        aria-label={
          reportMode
            ? "World map. Report mode: activate a location to place a report pin."
            : "World map of flagged clearing"
        }
      />

      {/* Status overlays. pointer-events-none so they never eat a map click. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 z-[1000] flex flex-wrap justify-center gap-2 px-4">
        {tiles === "loading" && (
          <span className="glass-nav flex items-center gap-2 rounded-full px-3 py-1.5 text-xs faint" role="status">
            <span className="spinner" aria-hidden="true" />
            Loading satellite imagery
          </span>
        )}
        {tiles === "error" && (
          <span
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
            role="status"
            style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
          >
            Some satellite tiles didn&apos;t load. Pan or zoom to retry.
          </span>
        )}
        {tiles !== "loading" && features.length === 0 && emptyHint && (
          <span className="glass-nav rounded-full px-3.5 py-1.5 text-xs faint" role="status">
            {emptyHint}
          </span>
        )}
      </div>
    </div>
  );
}
