"use client";

/**
 * The public map. Vanilla Leaflet (browser-only; load via dynamic ssr:false).
 * Satellite imagery + a place-name overlay so a journalist can orient without
 * prior knowledge. Flagged patches are red; clicking one selects it. In "report"
 * mode a click drops a pin to report clearing the map is missing.
 */
import { useEffect, useRef } from "react";
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
}

const PLACES_OVERLAY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

export default function PublicMap({
  features,
  selectedId,
  reportMode,
  pin,
  onSelectFeature,
  onDropPin,
}: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const featureLayer = useRef<L.LayerGroup | null>(null);
  const pinLayer = useRef<L.LayerGroup | null>(null);
  // Keep the latest callbacks/flags without re-initialising the map.
  const cb = useRef({ reportMode, onDropPin });
  cb.current = { reportMode, onDropPin };

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { worldCopyJump: true }).setView([4, 20], 3);
    L.tileLayer(ESRI_WORLD_IMAGERY.urlTemplate, {
      attribution: ESRI_WORLD_IMAGERY.attribution,
      maxZoom: ESRI_WORLD_IMAGERY.maxZoom,
    }).addTo(map);
    L.tileLayer(PLACES_OVERLAY, { maxZoom: 19, opacity: 0.9 }).addTo(map);
    featureLayer.current = L.layerGroup().addTo(map);
    pinLayer.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (cb.current.reportMode) cb.current.onDropPin([e.latlng.lng, e.latlng.lat]);
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
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
          color: selected ? "#facc15" : "#ef4444",
          weight: selected ? 3 : 1.5,
          fillColor: "#ef4444",
          fillOpacity: 0.35,
        },
      });
      poly.on("click", (e) => {
        L.DomEvent.stopPropagation(e); // don't also drop a pin
        onSelectFeature(f.id);
      });
      poly.addTo(layer);
    }
  }, [features, selectedId, onSelectFeature]);

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
        fillColor: "#2563eb",
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

  return <div ref={divRef} className="h-full w-full" style={{ minHeight: 320 }} />;
}
