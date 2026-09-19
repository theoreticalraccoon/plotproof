"use client";

/** /grow/sensor, put a real measurement into the anchoring ladder. */
import { useCallback, useEffect, useState } from "react";
import { Ruler } from "lucide-react";
import Breadcrumb from "@/components/shell/Breadcrumb";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PendingLink from "@/components/motion/PendingLink";
import Reveal from "@/components/motion/Reveal";
import { Skeleton } from "@/components/motion/Skeleton";
import SensorPanel from "@/components/grow/SensorPanel";
import { t, useLang } from "@/lib/i18n";
import { listPlots } from "@/lib/intake/store";
import { getGrowProfile, latestSoilMoisture, recentSensorReadings, clearSensorReadings } from "@/lib/grow/store";
import { useGrowPlot } from "@/lib/grow/useGrowPlot";
import { resolvePlotId, setSelectedPlotId, useSelectedPlotId } from "@/lib/grow/selection";
import { gridDisagreement } from "@/lib/sensor/calibrate";
import type { GrowProfile } from "@/lib/grow/types";
import type { SensorReading } from "@/lib/grow/growTypes";
import type { LocalPlot } from "@/lib/intake/types";

export default function SensorPage() {
  const lang = useLang();
  const [plots, setPlots] = useState<LocalPlot[] | null>(null);
  const [profile, setProfile] = useState<GrowProfile | null>(null);
  const [stored, setStored] = useState<SensorReading[]>([]);
  const [anchorVwc, setAnchorVwc] = useState<number | null>(null);

  const remembered = useSelectedPlotId();
  const plotId = resolvePlotId(plots ?? [], remembered);

  useEffect(() => {
    listPlots()
      .then(setPlots)
      .catch(() => setPlots([]));
  }, []);

  const refresh = useCallback(() => {
    if (!plotId) return;
    void recentSensorReadings(plotId, 200).then(setStored).catch(() => setStored([]));
    // The same call the irrigation engine makes, so what is shown here is what the ladder will
    // actually use, including its staleness and plausibility rules.
    void latestSoilMoisture(plotId).then(setAnchorVwc).catch(() => setAnchorVwc(null));
  }, [plotId]);

  useEffect(() => {
    if (!plotId) return;
    setProfile(null);
    setStored([]);
    getGrowProfile(plotId).then((p) => setProfile(p ?? null)).catch(() => setProfile(null));
    refresh();
  }, [plotId, refresh]);

  const plot = plots?.find((p) => p.id === plotId) ?? null;
  const grow = useGrowPlot(plot, profile);

  const gridVwc =
    grow.days.length > 0 ? grow.days[grow.days.length - 1].soilMoistureRootZone : null;
  const gap = gridDisagreement(anchorVwc, gridVwc);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-[13rem]">
          <Breadcrumb
            items={[
              { label: t(lang, "nav_home"), href: "/" },
              { label: t(lang, "nav_grow"), href: "/grow" },
              { label: t(lang, "sensor_title") },
            ]}
          />
        </div>
        {/* Below lg only: from lg up the nav bar already carries the switcher, and
            two of them side by side read as two different settings. */}
        <div className="lg:hidden">
          <LanguageSwitcher />
        </div>
      </div>

      <Reveal>
        <header className="mt-7">
          <p className="eyebrow flex items-center gap-2">
            <Ruler size={13} aria-hidden="true" style={{ color: "var(--accent)" }} />
            {t(lang, "nav_grow")}
          </p>
          <h1 className="font-display mt-3 text-[2rem] leading-[1.06] sm:text-[2.4rem]">
            {t(lang, "sensor_title")}
          </h1>
          <p className="mt-4 text-[1rem] leading-relaxed muted" style={{ maxWidth: "56ch" }}>
            {t(lang, "sensor_lede")}
          </p>
        </header>
      </Reveal>

      {plots === null && <Skeleton className="mt-8 h-40 w-full" />}

      {plots?.length === 0 && (
        <div className="glass-card mt-8 p-6 text-center">
          <p className="text-[0.95rem] muted">{t(lang, "grow_no_plots")}</p>
          <PendingLink href="/intake" className="btn btn-primary mt-4">
            {t(lang, "grow_no_plots_cta")}
          </PendingLink>
        </div>
      )}

      {plots && plots.length > 0 && plotId && (
        <div className="mt-8 space-y-6">
          {plots.length > 1 && (
            <section aria-labelledby="sensor-plot-picker">
              <h2 id="sensor-plot-picker" className="label">
                {t(lang, "grow_pick_plot")}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {plots.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlotId(p.id)}
                    aria-pressed={p.id === plotId}
                    className={p.id === plotId ? "chip chip-active" : "chip"}
                  >
                    {p.commodity ?? p.id.slice(0, 8)} · {p.computedAreaHa.toFixed(2)} ha
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* What the ladder is currently using for this plot. */}
          <section className="glass p-4" aria-labelledby="sensor-anchor-heading">
            <h2 id="sensor-anchor-heading" className="eyebrow">
              {t(lang, "sensor_anchor_title")}
            </h2>
            <p className="mt-2 text-[0.88rem]">
              {grow.irrigation
                ? t(lang, `irrigation_anchor_${grow.irrigation.anchorSource}`)
                : t(lang, "sensor_anchor_unknown")}
            </p>
            {gap && (
              <p className="mt-2.5 text-[0.85rem] muted" style={{ maxWidth: "56ch" }}>
                {t(lang, gap.probeIsWetter ? "sensor_gap_wetter" : "sensor_gap_drier", {
                  delta: gap.deltaVwc.toFixed(3),
                  probe: anchorVwc!.toFixed(3),
                  grid: gridVwc!.toFixed(3),
                })}
              </p>
            )}
            {stored.length > 0 && (
              <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] faint">
                <span>{t(lang, "sensor_stored", { n: stored.length })}</span>
                {stored.some((r) => r.source === "simulated") && (
                  <span style={{ color: "var(--warn)" }}>{t(lang, "sensor_stored_simulated")}</span>
                )}
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => {
                    void clearSensorReadings(plotId).then(refresh);
                  }}
                >
                  {t(lang, "sensor_clear_stored")}
                </button>
              </p>
            )}
          </section>

          <SensorPanel plotId={plotId} lang={lang} onSaved={refresh} />

          <PendingLink href="/grow" className="btn btn-ghost min-h-[44px]">
            {t(lang, "nav_grow")}
          </PendingLink>
        </div>
      )}
    </main>
  );
}
