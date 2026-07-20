"use client";

/**
 * Satellite basemap tracing — the production-default capture path (PROJECT.md).
 * Officer and farmer sit together; the farmer points, the officer taps corners.
 *
 * Every rule runs live as corners are added: area is measured, self-intersection
 * blocks the save, and overlap / area-mismatch surface as warnings. Tiles come
 * from the offline cache. Nothing saves at "end of session" — Save persists one
 * plot immediately and queues it for sync.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createOfflineTileLayer } from "./OfflineTileLayer";
import AttestationForm from "./AttestationForm";
import { getPosition } from "@/lib/geo/locate";
import { validatePlot } from "@/lib/intake/geometry";
import { cacheDistrict, type CacheProgress } from "@/lib/intake/tiles";
import {
  existingRings,
  listFarmers,
  newId,
  nowIso,
  saveFarmer,
  savePlot,
} from "@/lib/intake/store";
import type { ExistingPlot } from "@/lib/intake/geometry";
import type { LngLat, LocalFarmer, LocalPlot } from "@/lib/intake/types";

// Default view if geolocation is unavailable: central Sri Lanka.
const DEFAULT_CENTER: [number, number] = [7.2906, 80.6337];
const DEFAULT_ZOOM = 16;
const DEMO_COOP = "demo-coop";
const DEMO_COUNTRY = "LK";

export default function TraceMap({ onSaved }: { onSaved?: () => void }) {
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawRef = useRef<L.LayerGroup | null>(null);

  const [points, setPoints] = useState<LngLat[]>([]);
  const [existing, setExisting] = useState<ExistingPlot[]>([]);
  const [farmers, setFarmers] = useState<LocalFarmer[]>([]);
  const [farmerChoice, setFarmerChoice] = useState<string>("new");
  const [newFarmerName, setNewFarmerName] = useState("");
  const [claimedArea, setClaimedArea] = useState("");
  const [commodity, setCommodity] = useState("");
  const [district, setDistrict] = useState("district-1");
  const [caching, setCaching] = useState<CacheProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tileWarn, setTileWarn] = useState(false);
  // The just-saved plot awaiting attestation.
  const [attest, setAttest] = useState<
    { plotId: string; farmerName: string; farmerId?: string } | null
  >(null);

  const claimedHa = claimedArea ? Number(claimedArea) : undefined;

  const validation = useMemo(
    () =>
      validatePlot(points, {
        method: "traced",
        claimedAreaHa: Number.isFinite(claimedHa) ? claimedHa : undefined,
        existingPlots: existing,
      }),
    [points, claimedHa, existing],
  );

  // --- one-time map init ---
  useEffect(() => {
    if (!mapDiv.current || mapRef.current) return;
    const map = L.map(mapDiv.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    const tiles = createOfflineTileLayer();
    // Slow/absent wifi → tiles fail. Surface it instead of a blank grey map.
    tiles.on("tileerror", () => setTileWarn(true));
    tiles.on("load", () => setTileWarn(false));
    tiles.addTo(map);
    drawRef.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      setPoints((prev) => [...prev, [e.latlng.lng, e.latlng.lat]]);
    });
    mapRef.current = map;
    // Fix sizing after layout settles.
    setTimeout(() => map.invalidateSize(), 0);
    // Try to centre on the officer's location — but never depend on it.
    void getPosition({ timeoutMs: 5000 }).then((r) => {
      if (r.status === "ok") map.setView([r.lat, r.lng], 17);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- load farmers + existing plots for overlap checks ---
  useEffect(() => {
    void listFarmers().then(setFarmers);
    void existingRings().then(setExisting);
  }, []);

  // --- redraw markers + polygon whenever points change ---
  useEffect(() => {
    const layer = drawRef.current;
    if (!layer) return;
    layer.clearLayers();
    const latlngs = points.map(([lng, lat]) => L.latLng(lat, lng));
    const bad = validation.errors.some((e) => e.code === "self_intersecting");
    if (latlngs.length >= 2) {
      L.polygon(latlngs, {
        color: bad ? "#dc2626" : "#22c55e",
        weight: 2,
        fillOpacity: 0.15,
      }).addTo(layer);
    }
    latlngs.forEach((ll, i) =>
      L.circleMarker(ll, {
        radius: 6,
        color: "#fff",
        weight: 2,
        fillColor: "#22c55e",
        fillOpacity: 1,
      })
        .bindTooltip(String(i + 1))
        .addTo(layer),
    );
  }, [points, validation]);

  const undo = () => setPoints((p) => p.slice(0, -1));
  const clear = () => setPoints([]);

  const locate = async () => {
    const r = await getPosition({ timeoutMs: 8000 });
    if (r.status === "ok") {
      mapRef.current?.setView([r.lat, r.lng], 18);
      setMessage(null);
    } else {
      // Explainable, and reassuring: tracing doesn't need GPS at all.
      setMessage(`${r.message} You can still trace on the map — it doesn't use GPS.`);
    }
  };

  const downloadArea = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const z = map.getZoom();
    setCaching({ done: 0, total: 0, failed: 0 });
    const result = await cacheDistrict(
      district,
      { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
      z,
      Math.min(z + 2, 19),
      undefined,
      (p) => setCaching(p),
    );
    setCaching(result);
    setMessage(
      `Cached ${result.total - result.failed}/${result.total} tiles for "${district}".`,
    );
  }, [district]);

  const save = async () => {
    if (!validation.canSave || !validation.orderedRing) return;
    const name = farmerChoice === "new" ? newFarmerName.trim() : undefined;
    if (farmerChoice === "new" && !name) {
      setMessage("Enter the farmer's name (or pick an existing farmer).");
      return;
    }
    // Overlap / area-mismatch are non-blocking but must be acknowledged.
    if (validation.warnings.length > 0) {
      const ok = window.confirm(
        `${validation.warnings.map((w) => "• " + w.message).join("\n")}\n\nSave anyway?`,
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      let farmerId = farmerChoice;
      let farmerName = "";
      let farmerNationalId: string | undefined;
      if (farmerChoice === "new") {
        farmerId = newId();
        farmerName = name!;
        const farmer: LocalFarmer = {
          id: farmerId,
          cooperativeId: DEMO_COOP,
          countryCode: DEMO_COUNTRY,
          fullName: name!,
          capturedVia: "manual",
          createdAt: nowIso(),
        };
        await saveFarmer(farmer);
      } else {
        const f = farmers.find((x) => x.id === farmerChoice);
        farmerName = f?.fullName ?? "";
        farmerNationalId = f?.nationalId;
      }
      const plotId = newId();
      const plot: LocalPlot = {
        id: plotId,
        farmerId,
        cooperativeId: DEMO_COOP,
        countryCode: DEMO_COUNTRY,
        commodity: commodity || undefined,
        ring: validation.orderedRing,
        captureMethod: "traced",
        claimedAreaHa: Number.isFinite(claimedHa) ? claimedHa : undefined,
        computedAreaHa: validation.areaHa ?? 0,
        acknowledgedWarnings: validation.warnings.map((w) => w.code),
        status: "captured",
        syncStatus: "queued",
        capturedAt: nowIso(),
      };
      await savePlot(plot);
      setMessage(`Saved plot (${plot.computedAreaHa.toFixed(2)} ha). Now attest it.`);
      setPoints([]);
      setNewFarmerName("");
      setClaimedArea("");
      setCommodity("");
      void existingRings().then(setExisting);
      void listFarmers().then(setFarmers);
      setAttest({ plotId, farmerName, farmerId: farmerNationalId });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={mapDiv}
        className="h-[60vh] w-full rounded-lg border border-gray-300"
        style={{ minHeight: 320 }}
      />

      {tileWarn && (
        <p className="rounded bg-amber-50 px-3 py-1 text-xs text-amber-800">
          Some map imagery couldn&apos;t load (slow or no signal). You can still trace, and
          you can pre-cache a district with “Download this area” when you have signal.
        </p>
      )}

      {/* live readout */}
      <div className="text-sm">
        <span className="font-medium">{points.length} corners</span>
        {validation.areaHa != null && points.length >= 3 && (
          <span className="ml-3">≈ {validation.areaHa.toFixed(3)} ha</span>
        )}
        {validation.errors.map((e) => (
          <span key={e.code} className="ml-3 text-red-600">
            {e.message}
          </span>
        ))}
        {validation.warnings.map((w) => (
          <span key={w.code} className="ml-3 text-amber-600">
            {w.message}
          </span>
        ))}
      </div>

      {/* capture controls */}
      <div className="flex flex-wrap gap-2">
        <button onClick={locate} className="rounded bg-gray-200 px-3 py-2 text-sm">
          Locate me
        </button>
        <button
          onClick={undo}
          disabled={points.length === 0}
          className="rounded bg-gray-200 px-3 py-2 text-sm disabled:opacity-40"
        >
          Undo
        </button>
        <button
          onClick={clear}
          disabled={points.length === 0}
          className="rounded bg-gray-200 px-3 py-2 text-sm disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      {/* offline pre-cache */}
      <div className="flex flex-wrap items-center gap-2 rounded border border-gray-200 p-2">
        <span className="text-sm text-gray-600">Offline basemap:</span>
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="w-32 rounded border px-2 py-1 text-sm"
          aria-label="District name"
        />
        <button onClick={downloadArea} className="rounded bg-gray-800 px-3 py-2 text-sm text-white">
          Download this area
        </button>
        {caching && (
          <span className="text-sm text-gray-600">
            {caching.done}/{caching.total} tiles{caching.failed ? ` (${caching.failed} failed)` : ""}
          </span>
        )}
      </div>

      {/* farmer + save */}
      <div className="grid gap-2 rounded border border-gray-200 p-2 sm:grid-cols-2">
        <label className="text-sm">
          Farmer
          <select
            value={farmerChoice}
            onChange={(e) => setFarmerChoice(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-2"
          >
            <option value="new">+ New farmer…</option>
            {farmers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.fullName}
                {f.membershipNo ? ` (${f.membershipNo})` : ""}
              </option>
            ))}
          </select>
        </label>
        {farmerChoice === "new" && (
          <label className="text-sm">
            New farmer name
            <input
              value={newFarmerName}
              onChange={(e) => setNewFarmerName(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-2"
            />
          </label>
        )}
        <label className="text-sm">
          Claimed area (ha)
          <input
            inputMode="decimal"
            value={claimedArea}
            onChange={(e) => setClaimedArea(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-2"
          />
        </label>
        <label className="text-sm">
          Commodity
          <input
            value={commodity}
            onChange={(e) => setCommodity(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-2"
          />
        </label>
      </div>

      {!attest && (
        <button
          onClick={save}
          disabled={!validation.canSave || saving}
          className="rounded bg-green-600 px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save plot"}
        </button>
      )}

      {message && <p className="text-sm text-gray-700">{message}</p>}

      {attest && (
        <AttestationForm
          plotId={attest.plotId}
          defaultFarmerName={attest.farmerName}
          defaultFarmerId={attest.farmerId}
          onDone={() => {
            setAttest(null);
            setMessage("Plot attested and queued for sync.");
            onSaved?.();
          }}
          onSkip={() => setAttest(null)}
        />
      )}
    </div>
  );
}
