"use client";

/**
 * Acoustic preview. Shows the node roster, the exhibit for a plot (exactly what
 * the PDF exhibit section will render), and the recent event stream. No map -
 * the data shape is the point.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { AudioLines } from "lucide-react";
import Reveal from "@/components/motion/Reveal";
import Breadcrumb from "@/components/shell/Breadcrumb";
import { Skeleton } from "@/components/motion/Skeleton";
import { t, useLang } from "@/lib/i18n";
import type { AcousticEvent, AcousticExhibit, AcousticNode } from "@/lib/acoustic/types";

// The Ratnapura demo plot near which the simulated clearing burst was heard.
const DEMO_PLOT = { lng: 80.303, lat: 6.75 };

export default function AcousticPage() {
  const lang = useLang();
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
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-5 py-6 sm:px-8">
      <Reveal>
        <Breadcrumb items={[{ label: t(lang, "nav_home"), href: "/" }, { label: t(lang, "footer_acoustic") }]} />
        <header className="mt-3 flex items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <AudioLines size={17} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Acoustic ground truth</h1>
            <p className="text-sm muted">
              ESP32 nodes classify chainsaw / heavy-vehicle sounds on-device and send
              event flags over LoRa → gateway → this ingest. Satellite says where; the
              nodes say when.
            </p>
          </div>
        </header>
      </Reveal>

      {/* The PDF exhibit, previewed */}
      <Reveal delay={0.05}>
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide faint">
          PDF exhibit, corroboration near the Ratnapura plot
        </h2>
        {!exhibit && (
          <div className="glass-card p-4" role="status" aria-label="Loading exhibit">
            <div className="flex flex-wrap gap-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20" />
              ))}
            </div>
            <Skeleton className="mt-3 h-40 w-full" />
          </div>
        )}
        {exhibit && (
          <div className="glass-card p-4">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <Stat label="Events" value={exhibit.summary.total} />
              <Stat label="Chainsaw" value={exhibit.summary.chainsaw} />
              <Stat label="Heavy vehicle" value={exhibit.summary.heavyVehicle} />
              <Stat label="Nodes" value={exhibit.summary.nodes} />
              <Stat label="Radius" value={`${exhibit.radiusKm} km`} />
            </div>
            {exhibit.summary.firstAt && (
              <p className="mt-1 text-xs faint tabular-nums">
                {fmt(exhibit.summary.firstAt)} → {fmt(exhibit.summary.lastAt!)} (UTC)
              </p>
            )}
            <div className="data-wrap mt-3 max-h-56">
              <table className="w-full text-left text-xs">
                <thead>
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
                    <tr key={i}>
                      <td className="p-2 tabular-nums">{fmt(e.detectedAt)}</td>
                      <td className="p-2">
                        <ClassTag c={e.eventClass} />
                      </td>
                      <td className="p-2 tabular-nums">{(e.confidence * 100).toFixed(0)}%</td>
                      <td className="p-2 tabular-nums">{e.distanceKm.toFixed(2)} km</td>
                      <td className="p-2">{e.nodeLabel ?? e.nodeDevEui}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs faint">
              This is the real-shaped data the PDF exhibit section renders.
            </p>
          </div>
        )}
      </section>
      </Reveal>

      {/* Node roster */}
      <Reveal delay={0.1}>
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide faint">Nodes</h2>
        <ul className="data-wrap text-sm">
          {nodes.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-x-3 border-t p-2.5 first:border-t-0" style={{ borderColor: "var(--glass-border-2)" }}>
              <span className="font-semibold">{n.label ?? n.devEui}</span>
              <span className="font-mono text-xs faint">{n.devEui}</span>
              <span className="text-xs faint">{n.countryCode}</span>
              {n.batteryPct != null && <span className="text-xs faint tabular-nums">batt {n.batteryPct}%</span>}
              <span
                className={`tag ml-auto ${n.status === "active" ? "tag-accent" : "tag-muted"}`}
              >
                {n.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
      </Reveal>

      {/* Event stream */}
      <Reveal delay={0.15}>
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide faint">Recent events ({events.length})</h2>
        <div className="data-wrap max-h-72">
          <table className="w-full text-left text-xs">
            <thead>
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
                <tr key={e.id}>
                  <td className="p-2 tabular-nums">{fmt(e.detectedAt)}</td>
                  <td className="p-2">
                    <ClassTag c={e.eventClass} />
                  </td>
                  <td className="p-2 tabular-nums">{(e.confidence * 100).toFixed(0)}%</td>
                  <td className="p-2 font-mono">{e.devEui.slice(-4)}</td>
                  <td className="p-2 tabular-nums">
                    {e.rssi ?? "-"}/{e.snr ?? "-"}
                  </td>
                  <td className="p-2 tabular-nums">{e.fCnt ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </Reveal>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>{" "}
      <span className="faint">{label}</span>
    </span>
  );
}

function ClassTag({ c }: { c: string }) {
  const style: Record<string, CSSProperties> = {
    chainsaw: { background: "var(--danger-soft)", color: "var(--danger)" },
    heavy_vehicle: { background: "var(--warn-soft)", color: "var(--warn)" },
    other: { background: "var(--glass-border-2)", color: "var(--fg-faint)" },
  };
  return <span className="tag" style={style[c] ?? style.other}>{c}</span>;
}

function fmt(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}
