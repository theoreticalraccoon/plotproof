"use client";

/**
 * Captured plots on this device. Shows capture method, measured vs claimed
 * area, any acknowledged warnings, and sync state, the officer's running
 * tally for the day's work.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import { listFarmers, listPlots } from "@/lib/intake/store";
import { captureConfidence, type ConfidenceLevel } from "@/lib/intake/confidence";
import type { LocalFarmer, LocalPlot, SyncStatus } from "@/lib/intake/types";

const CONFIDENCE_DOT: Record<ConfidenceLevel, string> = {
  high: "var(--accent)",
  medium: "var(--warn)",
  low: "var(--fg-faint)",
};

const SYNC_STYLE: Record<SyncStatus, string> = {
  local: "tag-muted",
  queued: "tag-warn",
  syncing: "tag-info",
  synced: "tag-accent",
  error: "tag-warn",
};

export default function PlotList({ refreshSignal }: { refreshSignal: number }) {
  const [plots, setPlots] = useState<LocalPlot[]>([]);
  const [farmers, setFarmers] = useState<Map<string, LocalFarmer>>(new Map());

  useEffect(() => {
    void listPlots().then(setPlots);
    void listFarmers().then((fs) => setFarmers(new Map(fs.map((f) => [f.id, f]))));
  }, [refreshSignal]);

  if (plots.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-2 p-8 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <MapPinned size={20} />
        </span>
        <p className="text-sm font-medium">No plots yet</p>
        <p className="max-w-xs text-sm faint">
          Add your first plot with <strong>Import</strong> or <strong>Trace on satellite</strong> above. It saves on this device instantly, even offline.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {plots.map((p) => {
        const farmer = farmers.get(p.farmerId);
        const conf = captureConfidence(p.captureMethod);
        return (
          <li key={p.id} className="glass-card flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3 text-sm">
            <span className="font-semibold">{farmer?.fullName ?? "Unknown farmer"}</span>
            <span className="tag tag-muted inline-flex items-center gap-1" title={conf.rationale}>
              <span className="h-2 w-2 rounded-full" style={{ background: CONFIDENCE_DOT[conf.level] }} />
              {conf.label}
            </span>
            <span className="muted tabular-nums">{p.computedAreaHa.toFixed(2)} ha</span>
            {p.claimedAreaHa != null && (
              <span className="faint tabular-nums">claimed {p.claimedAreaHa.toFixed(2)}</span>
            )}
            {p.acknowledgedWarnings.length > 0 && (
              <span style={{ color: "var(--warn)" }}>⚠ {p.acknowledgedWarnings.join(", ")}</span>
            )}
            <span className={`tag ${p.status === "attested" ? "tag-accent" : "tag-muted"}`}>
              {p.status === "attested" ? "attested ✓" : "not attested"}
            </span>
            <span className={`tag ${SYNC_STYLE[p.syncStatus]} ml-auto`}>{p.syncStatus}</span>
            <Link href={`/plot/${p.id}`} className="text-xs font-semibold underline underline-offset-2" style={{ color: "var(--accent)" }}>
              Evidence pack →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
