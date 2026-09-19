"use client";

// Captured plots on this device. Shows capture method, measured vs claimed area, any
// acknowledged warnings, and sync state, the officer's running tally for the day's work.
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MapPinned, RotateCcw, TriangleAlert } from "lucide-react";
import PendingLink from "@/components/motion/PendingLink";
import ActionButton from "@/components/motion/ActionButton";
import { SkeletonList } from "@/components/motion/Skeleton";
import { listFarmers, listPlots } from "@/lib/intake/store";
import { captureConfidence, type ConfidenceLevel } from "@/lib/intake/confidence";
import type { LocalFarmer, LocalPlot, SyncStatus } from "@/lib/intake/types";
import { staggerContainer, staggerItem } from "@/lib/motion/variants";
import { t, useLang } from "@/lib/i18n";

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

// The status words are the raw lifecycle values an auditor will also see in the record, so they
// stay verbatim rather than being prettified; the hint carries the meaning instead.
const SYNC_HINT: Record<SyncStatus, string> = {
  local: "Saved on this device only. Not queued for sending yet.",
  queued: "Waiting in the outbox for the next successful sync.",
  syncing: "Being sent to the server now.",
  synced: "Confirmed stored on the server.",
  error: "Sending failed repeatedly. It stays on this device and will be retried.",
};

type LoadState = "loading" | "ready" | "error";

export default function PlotList({ refreshSignal }: { refreshSignal: number }) {
  const lang = useLang();
  const reduce = useReducedMotion();
  const [plots, setPlots] = useState<LocalPlot[]>([]);
  const [farmers, setFarmers] = useState<Map<string, LocalFarmer>>(new Map());
  const [state, setState] = useState<LoadState>("loading");

  // Rejects on failure, so the retry button can surface a real error state instead of leaving
  // the officer looking at a falsely empty list.
  const load = useCallback(async () => {
    const [ps, fs] = await Promise.all([listPlots(), listFarmers()]);
    setPlots(ps);
    setFarmers(new Map(fs.map((f) => [f.id, f])));
    setState("ready");
  }, []);

  useEffect(() => {
    void load().catch(() => setState("error"));
  }, [load, refreshSignal]);

  if (state === "loading") {
    return <SkeletonList count={3} lines={2} />;
  }

  if (state === "error") {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-xl p-5 text-sm"
        style={{ border: "1px solid var(--warn)", background: "var(--warn-soft)" }}
        role="alert"
      >
        <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--warn)" }}>
          <TriangleAlert size={16} aria-hidden="true" /> Couldn&apos;t read the plots on this device
        </p>
        <p className="muted">
          Local storage did not respond. Nothing has been lost, the read simply failed.
          Private-browsing mode blocks it on some Android browsers.
        </p>
        <ActionButton onAction={load} className="btn btn-ghost" loadingLabel={t(lang, "loading")}>
          <RotateCcw size={15} aria-hidden="true" /> {t(lang, "retry_label")}
        </ActionButton>
      </div>
    );
  }

  if (plots.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-2.5 px-6 py-10 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <MapPinned size={22} aria-hidden="true" />
        </span>
        <p className="text-base font-semibold">No plots yet</p>
        <p className="max-w-sm text-sm muted">
          Add your first plot with{" "}
          <strong className="font-semibold" style={{ color: "var(--fg)" }}>Import</strong> or{" "}
          <strong className="font-semibold" style={{ color: "var(--fg)" }}>Trace on satellite</strong>{" "}
          above. It saves on this device instantly, even offline.
        </p>
      </div>
    );
  }

  return (
    <motion.ul
      className="flex flex-col gap-2.5"
      variants={staggerContainer(0.04)}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      {plots.map((p) => {
        const farmer = farmers.get(p.farmerId);
        const conf = captureConfidence(p.captureMethod);
        return (
          <motion.li
            key={p.id}
            className="glass-card flex flex-col gap-2.5 p-3.5"
            variants={reduce ? undefined : staggerItem}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[0.98rem] font-semibold leading-snug">
                  {farmer?.fullName ?? "Unknown farmer"}
                </p>
                <span className="mt-1 inline-flex items-center gap-1.5 text-xs faint" title={conf.rationale}>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: CONFIDENCE_DOT[conf.level] }}
                    aria-hidden="true"
                  />
                  {conf.label}
                </span>
              </div>
              <span className={`tag ${SYNC_STYLE[p.syncStatus]} shrink-0`} title={SYNC_HINT[p.syncStatus]}>
                {p.syncStatus}
              </span>
            </div>

            {/* Area is the number an officer scans a list for in sunlight, so it
                carries the largest type on the row. */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-lg font-semibold leading-none tabular-nums">
                {p.computedAreaHa.toFixed(2)}
                <span className="ml-1 text-xs font-medium muted">ha measured</span>
              </span>
              {p.claimedAreaHa != null && (
                <span className="text-xs faint tabular-nums">claimed {p.claimedAreaHa.toFixed(2)} ha</span>
              )}
            </div>

            {p.acknowledgedWarnings.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs font-medium" style={{ color: "var(--warn)" }}>
                <TriangleAlert size={13} className="mt-px shrink-0" aria-hidden="true" />
                {p.acknowledgedWarnings.join(", ")}
              </p>
            )}

            <div
              className="-mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-2"
              style={{ borderTop: "1px solid var(--glass-hairline)" }}
            >
              <span className={`tag ${p.status === "attested" ? "tag-accent" : "tag-muted"}`}>
                {p.status === "attested" ? "attested ✓" : "not attested"}
              </span>
              <PendingLink
                href={`/plot/${p.id}`}
                className="-mr-2 inline-flex min-h-11 items-center rounded-[10px] px-2 text-sm font-semibold underline underline-offset-2"
                style={{ color: "var(--accent)" }}
                ariaLabel={`Evidence pack for ${farmer?.fullName ?? "this plot"}`}
              >
                Evidence pack →
              </PendingLink>
            </div>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
