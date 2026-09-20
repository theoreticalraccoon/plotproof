"use client";

// The GROW lane front door: pick a plot, state the crop and soil once, then see watering and
// disease pressure computed from that plot's own weather.
import { useCallback, useState } from "react";
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
import { NoPlots, PlotPicker, WeatherUnavailable } from "@/components/grow/PlotStates";
import { t, useLang } from "@/lib/i18n";
import { useGrowSession } from "@/lib/grow/useGrowSession";
import { RISK_CAVEATS } from "@/lib/grow/risk";
import type { GrowProfile } from "@/lib/grow/types";

export default function GrowPage() {
  const lang = useLang();
  const [editing, setEditing] = useState(false);
  const session = useGrowSession({ paused: editing });
  const { plots, plot, profile, profileLoaded, grow } = session;
  // A plot with no profile yet goes straight to the form.
  const editingProfile = editing || (profileLoaded && !profile);

  const handleSaveProfile = useCallback(
    (p: GrowProfile) => {
      session.saveProfile(p);
      setEditing(false);
    },
    [session],
  );

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-[13rem]">
          <Breadcrumb
            items={[{ label: t(lang, "nav_home"), href: "/" }, { label: t(lang, "nav_grow") }]}
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

      {plots?.length === 0 && <NoPlots lang={lang} />}

      {plots && plots.length > 0 && (
        <>
          <PlotPicker
            plots={plots}
            selectedId={plot?.id ?? null}
            onSelect={session.selectPlot}
            lang={lang}
            id="plot-picker"
            className="mt-8"
          />

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
                  className="inline-flex min-h-[40px] items-center text-[0.82rem] underline underline-offset-4 muted"
                  onClick={() => setEditing(true)}
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
              <div className="flex flex-wrap gap-2">
                {profile.crop === "tea" && (
                  <PendingLink href="/grow/diagnose" className="btn btn-primary min-h-[48px]">
                    {t(lang, "risk_check_leaves")}
                  </PendingLink>
                )}
                {/* The only route that can move this plot from a modelled soil
                    estimate to a measured one. Offered for every crop: the water
                    balance is crop-general even though the leaf checker is not. */}
                <PendingLink href="/grow/sensor" className="btn btn-ghost min-h-[48px]">
                  {t(lang, "sensor_open")}
                </PendingLink>
              </div>

              {/* Weather down and nothing cached: say so, and show NOTHING below.
                  Every number on this page is derived from weather, so rendering
                  any of it without weather would be inventing it. */}
              {grow.state === "unavailable" && <WeatherUnavailable grow={grow} lang={lang} />}

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
