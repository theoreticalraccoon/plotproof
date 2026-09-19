"use client";

// One plot on satellite imagery, with the two forest layers the EUDR screening is built from
// drawn over it.
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_LAYERS } from "@/lib/eudr/gfw";
import type { LngLat } from "@/lib/intake/types";

const IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export default function ForestMap({
  ring,
  labels,
}: {
  ring: LngLat[];
  labels: { jrc: string; hansen: string; plot: string };
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layers = useRef<{ jrc: L.TileLayer; hansen: L.TileLayer } | null>(null);
  const [show, setShow] = useState({ jrc: true, hansen: true });

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false, // a page that scrolls should not be hijacked by the map
    });
    mapRef.current = map;

    L.tileLayer(IMAGERY, { maxZoom: 19, attribution: "Imagery © Esri" }).addTo(map);
    const jrc = L.tileLayer(TILE_LAYERS.jrc, {
      maxNativeZoom: 12,
      maxZoom: 19,
      opacity: 0.55,
      attribution: "Forest 2020 © EC JRC (GFC2020 v2020.3), via Global Forest Watch",
    }).addTo(map);
    const hansen = L.tileLayer(TILE_LAYERS.hansen, {
      maxNativeZoom: 12,
      maxZoom: 19,
      opacity: 0.85,
      attribution: "Tree cover loss © Hansen/UMD/Google/USGS/NASA (GFC v1.13), CC BY 4.0",
    }).addTo(map);
    layers.current = { jrc, hansen };

    // Leaflet wants [lat, lng]; the plot record is GeoJSON order [lng, lat].
    const poly = L.polygon(
      ring.map(([lng, lat]) => [lat, lng] as [number, number]),
      { color: "#ffffff", weight: 2.5, fillOpacity: 0 },
    ).addTo(map);
    map.fitBounds(poly.getBounds(), { padding: [24, 24], maxZoom: 17 });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [ring]);

  useEffect(() => {
    const map = mapRef.current;
    const l = layers.current;
    if (!map || !l) return;
    for (const k of ["jrc", "hansen"] as const) {
      if (show[k] && !map.hasLayer(l[k])) l[k].addTo(map);
      if (!show[k] && map.hasLayer(l[k])) map.removeLayer(l[k]);
    }
  }, [show]);

  return (
    <div>
      <div
        ref={el}
        className="h-64 w-full overflow-hidden rounded-[var(--radius-sm)] sm:h-72"
        style={{ background: "var(--bg-1)" }}
        role="img"
        aria-label={labels.plot}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <LayerToggle
          on={show.jrc}
          color="#2e9e5b"
          label={labels.jrc}
          onChange={(v) => setShow((s) => ({ ...s, jrc: v }))}
        />
        <LayerToggle
          on={show.hansen}
          color="#e2468a"
          label={labels.hansen}
          onChange={(v) => setShow((s) => ({ ...s, hansen: v }))}
        />
      </div>
    </div>
  );
}

function LayerToggle({
  on,
  color,
  label,
  onChange,
}: {
  on: boolean;
  color: string;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="chip inline-flex min-h-[36px] cursor-pointer items-center gap-2">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span
        aria-hidden="true"
        className="h-3 w-3 rounded-sm"
        style={{ background: on ? color : "transparent", border: `1.5px solid ${color}` }}
      />
      <span>{label}</span>
    </label>
  );
}
