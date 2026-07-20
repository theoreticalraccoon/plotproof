"use client";

/**
 * Captured plots on this device. Shows capture method, measured vs claimed
 * area, any acknowledged warnings, and sync state — the officer's running
 * tally for the day's work.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { listFarmers, listPlots } from "@/lib/intake/store";
import { captureConfidence, type ConfidenceLevel } from "@/lib/intake/confidence";
import type { LocalFarmer, LocalPlot, SyncStatus } from "@/lib/intake/types";

const CONFIDENCE_DOT: Record<ConfidenceLevel, string> = {
  high: "bg-green-500",
  medium: "bg-amber-500",
  low: "bg-gray-400",
};

const SYNC_STYLE: Record<SyncStatus, string> = {
  local: "bg-gray-200 text-gray-700",
  queued: "bg-amber-100 text-amber-800",
  syncing: "bg-blue-100 text-blue-800",
  synced: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

export default function PlotList({ refreshSignal }: { refreshSignal: number }) {
  const [plots, setPlots] = useState<LocalPlot[]>([]);
  const [farmers, setFarmers] = useState<Map<string, LocalFarmer>>(new Map());

  useEffect(() => {
    void listPlots().then(setPlots);
    void listFarmers().then((fs) => setFarmers(new Map(fs.map((f) => [f.id, f]))));
  }, [refreshSignal]);

  if (plots.length === 0) {
    return <p className="text-sm text-gray-500">No plots captured yet.</p>;
  }

  return (
    <ul className="divide-y divide-gray-200 rounded border border-gray-200">
      {plots.map((p) => {
        const farmer = farmers.get(p.farmerId);
        const conf = captureConfidence(p.captureMethod);
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
            <span className="font-medium">{farmer?.fullName ?? "Unknown farmer"}</span>
            <span
              className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              title={conf.rationale}
            >
              <span className={`h-2 w-2 rounded-full ${CONFIDENCE_DOT[conf.level]}`} />
              {conf.label}
            </span>
            <span className="text-gray-700">{p.computedAreaHa.toFixed(2)} ha</span>
            {p.claimedAreaHa != null && (
              <span className="text-gray-400">claimed {p.claimedAreaHa.toFixed(2)}</span>
            )}
            {p.acknowledgedWarnings.length > 0 && (
              <span className="text-amber-600">⚠ {p.acknowledgedWarnings.join(", ")}</span>
            )}
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                p.status === "attested"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {p.status === "attested" ? "attested ✓" : "not attested"}
            </span>
            <span
              className={`ml-auto rounded px-2 py-0.5 text-xs ${SYNC_STYLE[p.syncStatus]}`}
            >
              {p.syncStatus}
            </span>
            <Link href={`/plot/${p.id}`} className="text-xs font-medium text-green-700 underline">
              Evidence pack →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
