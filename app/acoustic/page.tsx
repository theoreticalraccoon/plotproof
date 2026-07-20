"use client";

/**
 * Acoustic preview. Shows the node roster, the exhibit for a plot (exactly what
 * the PDF exhibit section will render), and the recent event stream. No map —
 * the data shape is the point.
 */
import { useEffect, useState } from "react";
import type { AcousticEvent, AcousticExhibit, AcousticNode } from "@/lib/acoustic/types";

// The Ratnapura demo plot near which the simulated clearing burst was heard.
const DEMO_PLOT = { lng: 80.303, lat: 6.75 };

export default function AcousticPage() {
  const [nodes, setNodes] = useState<AcousticNode[]>([]);
  const [events, setEvents] = useState<AcousticEvent[]>([]);
  const [exhibit, setExhibit] = useState<AcousticExhibit | null>(null);

  useEffect(() => {
    void fetch("/api/acoustic/events")
      .then((r) => r.json())
      .then((d) => {
        setNodes(d.nodes ?? []);
        setEvents(d.events ?? []);
      });
    void fetch(`/api/acoustic/exhibit?lng=${DEMO_PLOT.lng}&lat=${DEMO_PLOT.lat}&radiusKm=3&days=60`)
      .then((r) => r.json())
      .then(setExhibit);
  }, []);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4">
      <header>
        <h1 className="text-xl font-semibold">Acoustic ground truth</h1>
        <p className="text-sm text-gray-500">
          ESP32 nodes classify chainsaw / heavy-vehicle sounds on-device and send
          event flags over LoRa → gateway → this ingest. Satellite says where; the
          nodes say when.
        </p>
      </header>

      {/* The PDF exhibit, previewed */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          PDF exhibit — corroboration near the Ratnapura plot
        </h2>
        {exhibit && (
          <div className="rounded-lg border-2 border-gray-800 p-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Stat label="Events" value={exhibit.summary.total} />
              <Stat label="Chainsaw" value={exhibit.summary.chainsaw} />
              <Stat label="Heavy vehicle" value={exhibit.summary.heavyVehicle} />
              <Stat label="Nodes" value={exhibit.summary.nodes} />
              <Stat label="Radius" value={`${exhibit.radiusKm} km`} />
            </div>
            {exhibit.summary.firstAt && (
              <p className="mt-1 text-xs text-gray-500">
                {fmt(exhibit.summary.firstAt)} → {fmt(exhibit.summary.lastAt!)} (UTC)
              </p>
            )}
            <div className="mt-2 max-h-56 overflow-auto rounded border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    <th className="p-2">Time (UTC)</th>
                    <th className="p-2">Class</th>
                    <th className="p-2">Conf.</th>
                    <th className="p-2">Dist.</th>
                    <th className="p-2">Node</th>
                  </tr>
                </thead>
                <tbody>
                  {exhibit.events.map((e, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{fmt(e.detectedAt)}</td>
                      <td className="p-2">
                        <ClassTag c={e.eventClass} />
                      </td>
                      <td className="p-2">{(e.confidence * 100).toFixed(0)}%</td>
                      <td className="p-2">{e.distanceKm.toFixed(2)} km</td>
                      <td className="p-2">{e.nodeLabel ?? e.nodeDevEui}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              This is the real-shaped data the PDF exhibit section renders.
            </p>
          </div>
        )}
      </section>

      {/* Node roster */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Nodes</h2>
        <ul className="divide-y divide-gray-200 rounded border border-gray-200 text-sm">
          {nodes.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-x-3 p-2">
              <span className="font-medium">{n.label ?? n.devEui}</span>
              <span className="font-mono text-xs text-gray-500">{n.devEui}</span>
              <span className="text-xs text-gray-500">{n.countryCode}</span>
              {n.batteryPct != null && <span className="text-xs text-gray-500">🔋 {n.batteryPct}%</span>}
              <span
                className={`ml-auto rounded px-2 py-0.5 text-xs ${
                  n.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                }`}
              >
                {n.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Event stream */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Recent events ({events.length})</h2>
        <div className="max-h-72 overflow-auto rounded border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                <th className="p-2">Time (UTC)</th>
                <th className="p-2">Class</th>
                <th className="p-2">Conf.</th>
                <th className="p-2">Node</th>
                <th className="p-2">RSSI/SNR</th>
                <th className="p-2">fCnt</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-2">{fmt(e.detectedAt)}</td>
                  <td className="p-2">
                    <ClassTag c={e.eventClass} />
                  </td>
                  <td className="p-2">{(e.confidence * 100).toFixed(0)}%</td>
                  <td className="p-2 font-mono">{e.devEui.slice(-4)}</td>
                  <td className="p-2">
                    {e.rssi ?? "—"}/{e.snr ?? "—"}
                  </td>
                  <td className="p-2">{e.fCnt ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <span className="text-lg font-semibold">{value}</span>{" "}
      <span className="text-gray-500">{label}</span>
    </span>
  );
}

function ClassTag({ c }: { c: string }) {
  const map: Record<string, string> = {
    chainsaw: "bg-red-100 text-red-800",
    heavy_vehicle: "bg-amber-100 text-amber-800",
    other: "bg-gray-100 text-gray-600",
  };
  return <span className={`rounded px-2 py-0.5 ${map[c] ?? "bg-gray-100"}`}>{c}</span>;
}

function fmt(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}
