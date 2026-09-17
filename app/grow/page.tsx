"use client";

/**
 * The GROW lane front door: pick a plot, state the crop and soil once, then see
 * watering and disease pressure computed from that plot's own weather.
 *
 * Reuses the field-capture spine rather than duplicating it — plots come from
 * the same Dexie store the officer captured into, and the weather grid cell is
 * derived from the attested boundary via `plotCentre`. One record, three lanes.
 *
 * Every failure path here is a readable sentence with a retry, never a spinner
 * that never resolves: no plots, no boundary, no network, no cache. Same
 * demo-path hardening rule the rest of the app was built to (D-013).
 */
import { useCallback, useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import Breadcrumb from "@/components/shell/Breadcrumb";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PendingLink from "@/components/motion/PendingLink";
import Reveal from "@/components/motion/Reveal";
import { Skeleton } from "@/components/motion/Skeleton";
import ProfileForm from "@/components/grow/ProfileForm";
import IrrigationCard from "@/components/grow/IrrigationCard";
import RiskCard from "@/components/grow/RiskCard";
import WeatherStrip from "@/components/grow/WeatherStrip";
import { t, useLang } from "@/lib/i18n";
import { listPlots } from "@/lib/intake/store";
import { getGrowProfile, saveGrowProfile } from "@/lib/grow/store";
import { useGrowPlot } from "@/lib/grow/useGrowPlot";
import { resolvePlotId, setSelectedPlotId, useSelectedPlotId } from "@/lib/grow/selection";
import { RISK_CAVEATS } from "@/lib/grow/risk";
import type { GrowProfile } from "@/lib/grow/types";
import type { LocalPlot } from "@/lib/intake/types";

export default function GrowPage() {
  const lang = useLang();
  const [plots, setPlots] = useState<LocalPlot[] | null>(null);
  const [profile, setProfile] = useState<GrowProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  // Dexie is browser-only, so every read is guarded and failure degrades to
  // "no plots" rather than an unhandled rejection.
  useEffect(() => {
    listPlots()
      .then(setPlots)
      .catch(() => setPlots([]));
  }, []);

  // Shared with /grow/diagnose so the two pages cannot drift onto different
  // plots. See lib/grow/selection.ts for why that mattered.
  const remembered = useSelectedPlotId();
  const plotId = resolvePlotId(plots ?? [], remembered);

  useEffect(() => {
    if (!plotId) return;
    // Same reason as on /grow/diagnose: never let the previous plot's crop and
    // soil drive this plot's numbers, not even for a frame.
    setProfile(null);
    getGrowProfile(plotId)
      .then((p) => {
        setProfile(p ?? null);
        setEditingProfile(!p);
      })
      .catch(() => {
        setProfile(null);
        setEditingProfile(true);
      });
  }, [plotId]);

  const plot = plots?.find((p) => p.id === plotId) ?? null;
  const grow = useGrowPlot(editingProfile ? null : plot, profile);

  const handleSaveProfile = useCallback((p: GrowProfile) => {
    setProfile(p);
    setEditingProfile(false);
    void saveGrowProfile(p).catch(() => {});
  }, []);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb
          items={[{ label: t(lang, "nav_home"), href: "/" }, { label: t(lang, "nav_grow") }]}
        />
        <LanguageSwitcher />
      </div>

      <Reveal>
        <header className="mt-7">
          <p className="eyebrow flex items-center gap-2">
            <Leaf size={13} aria-hidden="true" style={{ color: "var(--accent)" }} />
            {t(lang, "grow_title")}
          </p>
          <h1 className="font-display mt-3 text-[2rem] leading-[1.06] sm:text-[2.4rem]">
            {t(lang, "grow_title")}
          </h1>
          <p className="mt-4 text-[1rem] leading-relaxed muted" style={{ maxWidth: "54ch" }}>
            {t(lang, "grow_lede")}
          </p>
        </header>
      </Reveal>

      {plots === null && <Skeleton className="mt-8 h-32 w-full" />}

      {/* No plots at all: the grow lane has nothing to stand on, so send the
          farmer to the capture flow rather than showing an empty dashboard. */}
      {plots?.length === 0 && (
        <div className="glass-card mt-8 p-6 text-center">
          <p className="text-[0.95rem] muted">{t(lang, "grow_no_plots")}</p>
          <PendingLink href="/intake" className="btn btn-primary mt-4">
            {t(lang, "grow_no_plots_cta")}
          </PendingLink>
        </div>
      )}

      {plots && plots.length > 0 && (
        <>
          {plots.length > 1 && (
            <section className="mt-8" aria-labelledby="plot-picker">
              <h2 id="plot-picker" className="label">
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

          {plot && editingProfile && (
            <div className="mt-6">
              <ProfileForm
                plotId={plot.id}
                initial={profile}
                lang={lang}
                onSave={handleSaveProfile}
              />
            </div>
          )}

          {plot && profile && !editingProfile && (
            <div className="mt-8 space-y-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[0.88rem] muted">
                  {t(lang, `grow_crop_${profile.crop}`)} ·{" "}
                  {t(lang, `grow_soil_${profile.soilTexture}`)} ·{" "}
                  {plot.computedAreaHa.toFixed(2)} ha
                </p>
                <button
                  type="button"
                  className="text-[0.82rem] underline underline-offset-4 muted"
                  onClick={() => setEditingProfile(true)}
                >
                  {t(lang, "grow_edit_profile")}
                </button>
              </div>

              {grow.state === "loading" && (
                <div className="space-y-4">
                  <p className="text-[0.9rem] muted">{t(lang, "weather_loading")}</p>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              )}

              {/* The bridge from "conditions favour this" to "look at an actual
                  leaf". Deliberately OUTSIDE the weather-dependent block: the
                  leaf checker runs on a photograph and does not need weather,
                  so a tea grower with no signal must still be able to reach it.
                  Weather pressure is not a diagnosis; this is the only thing in
                  the lane that looks at a leaf. */}
              {profile.crop === "tea" && (
                <PendingLink href="/grow/diagnose" className="btn btn-primary min-h-[48px]">
                  {t(lang, "risk_check_leaves")}
                </PendingLink>
              )}

              {/* Weather down and nothing cached: say so, and show NOTHING below.
                  Every number on this page is derived from weather, so rendering
                  any of it without weather would be inventing it. */}
              {grow.state === "unavailable" && (
                <div
                  className="rounded-[var(--radius-sm)] px-4 py-3.5"
                  style={{ background: "var(--warn-soft)", borderLeft: "3px solid var(--warn)" }}
                >
                  <p className="text-[0.92rem]">{t(lang, "weather_unavailable")}</p>
                  {/* Network-layer detail, English in every language. */}
                  {grow.reason && (
                    <p className="mt-1.5 text-[0.82rem] muted" lang="en">
                      {grow.reason}
                    </p>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={grow.refresh}>
                    {t(lang, "weather_retry")}
                  </button>
                </div>
              )}

              {grow.state === "ready" && (
                <>
                  <WeatherStrip
                    days={grow.days}
                    lang={lang}
                    observedThrough={grow.observedThrough}
                    cachedAt={grow.cachedAt}
                  />

                  {grow.irrigation && (
                    <IrrigationCard
                      advice={grow.irrigation}
                      lang={lang}
                      rainfed={!profile.irrigated}
                    />
                  )}

                  {grow.risks.length > 0 && (
                    <section aria-labelledby="risk-heading">
                      <h2 id="risk-heading" className="eyebrow">
                        {t(lang, "risk_title")}
                      </h2>
                      <p className="mt-2 text-[0.88rem] muted" style={{ maxWidth: "54ch" }}>
                        {t(lang, "risk_lede")}
                      </p>

                      <div className="mt-4 space-y-3">
                        {grow.risks.map((r) => (
                          <RiskCard key={r.disease} risk={r} lang={lang} />
                        ))}
                      </div>

                      <p className="mt-4 text-[0.85rem]" style={{ color: "var(--warn)" }}>
                        {t(lang, "risk_not_diagnosis")}
                      </p>

                      <details className="mt-4">
                        <summary className="cursor-pointer text-[0.85rem] font-medium muted">
                          {t(lang, "risk_caveats_title")}
                        </summary>
                        <ul
                          className="mt-3 space-y-2 border-l-2 pl-4 text-[0.82rem] muted"
                          style={{ borderColor: "var(--glass-hairline)" }}
                        >
                          {RISK_CAVEATS.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                          <li style={{ color: "var(--warn)" }}>{t(lang, "risk_no_spray_advice")}</li>
                        </ul>
                      </details>
                    </section>
                  )}

                  {/* Non-tea crops: watering is crop-general, but the disease
                      windows are Camellia sinensis pathogens. Say that rather
                      than scoring a rubber plot against tea biology. */}
                  {profile.crop !== "tea" && (
                    <p className="text-[0.85rem] muted" style={{ maxWidth: "54ch" }}>
                      {t(lang, "grow_disease_tea_only", {
                        crop: t(lang, `grow_crop_${profile.crop}`),
                      })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
