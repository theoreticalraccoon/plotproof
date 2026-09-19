"use client";

/** /grow/diagnose, the complete advisory for one plot. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Leaf } from "lucide-react";
import Breadcrumb from "@/components/shell/Breadcrumb";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PendingLink from "@/components/motion/PendingLink";
import Reveal from "@/components/motion/Reveal";
import { Skeleton } from "@/components/motion/Skeleton";
import LeafCapture from "@/components/grow/LeafCapture";
import LeafAssessment from "@/components/grow/LeafAssessment";
import AdvisoryExplanation from "@/components/grow/AdvisoryExplanation";
import IrrigationCard from "@/components/grow/IrrigationCard";
import RiskCard from "@/components/grow/RiskCard";
import DiagnosticsPanel from "@/components/grow/DiagnosticsPanel";
import { t, useLang } from "@/lib/i18n";
import { listPlots } from "@/lib/intake/store";
import { getGrowProfile } from "@/lib/grow/store";
import { useGrowPlot } from "@/lib/grow/useGrowPlot";
import { resolvePlotId, setSelectedPlotId, useSelectedPlotId } from "@/lib/grow/selection";
import { MODEL_URL, loadTeaCard } from "@/lib/grow/tea/card";
import { classifyLeaf } from "@/lib/grow/tea/infer";
import { buildAdvisory } from "@/lib/grow/tea/evidence";
import {
  buildDiagnosticRows,
  diagnosticsEnabled,
  verifyPublishedModel,
  type ArtifactCheck,
  type RuntimeFacts,
} from "@/lib/grow/tea/diagnostics";
import type { TeaAdvisory, TeaModelCard, TeaPrediction } from "@/lib/grow/tea/types";
import type { GrowProfile } from "@/lib/grow/types";
import type { LocalPlot } from "@/lib/intake/types";

export default function DiagnosePage() {
  const lang = useLang();
  const [plots, setPlots] = useState<LocalPlot[] | null>(null);
  const [profile, setProfile] = useState<GrowProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [card, setCard] = useState<TeaModelCard | null | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [prediction, setPrediction] = useState<TeaPrediction | null>(null);

  // The plot is remembered across /grow <-> /grow/diagnose.
  const remembered = useSelectedPlotId();
  const plotId = resolvePlotId(plots ?? [], remembered);

  // --- diagnostics (?diag=1) --------------------------------------------- Read in an effect,
  // not during render.
  const [diag, setDiag] = useState(false);
  const [runtime, setRuntime] = useState<RuntimeFacts | null>(null);
  const [artifact, setArtifact] = useState<ArtifactCheck | null>(null);

  useEffect(() => {
    listPlots()
      .then(setPlots)
      .catch(() => setPlots([]));
    void loadTeaCard().then(setCard);
    setDiag(diagnosticsEnabled(window.location.search));
  }, []);

  useEffect(() => {
    if (!plotId) return;
    // Clear first.
    setProfile(null);
    setProfileLoaded(false);
    let cancelled = false;
    getGrowProfile(plotId)
      .then((p) => {
        if (cancelled) return;
        setProfile(p ?? null);
        setProfileLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setProfileLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [plotId]);

  // A leaf result belongs to the plot it was taken for.
  useEffect(() => {
    setPrediction(null);
    setRuntime(null);
  }, [plotId]);

  // Hash the bytes the browser actually received and compare them to the card.
  useEffect(() => {
    if (!diag || !card || card === "loading") return;
    void verifyPublishedModel(MODEL_URL, card).then(setArtifact);
  }, [diag, card]);

  const plot = plots?.find((p) => p.id === plotId) ?? null;
  // Reads the existing engines. Nothing here recomputes weather, irrigation or risk, and no leaf
  // result is an input to any of them.
  const grow = useGrowPlot(plot, profile);

  const analyse = useCallback(async (img: HTMLImageElement) => {
    setBusy(true);
    setPrediction(null);
    try {
      const { prediction: p, runtime: r } = await classifyLeaf(img);
      setPrediction(p);
      setRuntime(r);
    } finally {
      setBusy(false);
    }
  }, []);

  const advisory: TeaAdvisory | null = useMemo(() => {
    if (!prediction) return null;
    return buildAdvisory({
      prediction,
      risks: grow.risks,
      irrigation: grow.irrigation,
      observedThrough: grow.observedThrough,
    });
  }, [prediction, grow.risks, grow.irrigation, grow.observedThrough]);

  const teaPlot = profile?.crop === "tea";

  const diagRows = useMemo(
    () =>
      diag
        ? buildDiagnosticRows(card === "loading" ? null : card, prediction, runtime, artifact)
        : [],
    [diag, card, prediction, runtime, artifact],
  );
  const diagFailures = diagRows.filter((r) => r.ok === false).length;

  const ready = card && card !== "loading" && plots && plots.length > 0;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-[13rem]">
          <Breadcrumb
            items={[
              { label: t(lang, "nav_home"), href: "/" },
              { label: t(lang, "nav_grow"), href: "/grow" },
              { label: t(lang, "tea_title") },
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
            <Leaf size={13} aria-hidden="true" style={{ color: "var(--accent)" }} />
            {t(lang, "nav_grow")}
          </p>
          <h1 className="font-display mt-3 text-[2rem] leading-[1.06] sm:text-[2.4rem]">
            {t(lang, "tea_title")}
          </h1>
          <p className="mt-4 text-[1rem] leading-relaxed muted" style={{ maxWidth: "54ch" }}>
            {t(lang, "tea_lede")}
          </p>

          {/* Most tea_* advisory sentences fall back to English, including every
              action line. That is the deliberate policy (D-016: never
              machine-translate an instruction a farmer acts on), but it was
              silent. A Sinhala or Tamil reader is now told so in their own
              language rather than simply meeting English text. */}
          {lang !== "en" && (
            <p className="mt-3 text-[0.82rem] faint" style={{ maxWidth: "54ch" }} lang={lang}>
              {t(lang, "tea_guidance_in_english")}
            </p>
          )}
        </header>
      </Reveal>

      {(plots === null || card === "loading") && <Skeleton className="mt-8 h-40 w-full" />}

      {/* No published artifact: say so and send them back to the advice that
          still works, rather than offering a camera that cannot do anything. */}
      {card === null && plots !== null && (
        <div
          className="mt-8 rounded-[var(--radius-sm)] px-4 py-3.5"
          style={{ background: "var(--warn-soft)", borderLeft: "3px solid var(--warn)" }}
        >
          <p className="text-[0.92rem]">{t(lang, "tea_error_no_artifact")}</p>
          <p className="mt-1.5 text-[0.85rem] muted">{t(lang, "tea_error_still_useful")}</p>
          <PendingLink href="/grow" className="btn btn-ghost btn-sm mt-3">
            {t(lang, "nav_grow")}
          </PendingLink>
        </div>
      )}

      {plots?.length === 0 && (
        <div className="glass-card mt-8 p-6 text-center">
          <p className="text-[0.95rem] muted">{t(lang, "grow_no_plots")}</p>
          <PendingLink href="/intake" className="btn btn-primary mt-4">
            {t(lang, "grow_no_plots_cta")}
          </PendingLink>
        </div>
      )}

      {ready && (
        <div className="mt-8 space-y-8">
          {plots.length > 1 && (
            <section aria-labelledby="dx-plot-picker">
              <h2 id="dx-plot-picker" className="label">
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

          {/* No grow profile yet: the whole advisory rests on crop and soil, so
              ask for them on /grow rather than guessing either. */}
          {profileLoaded && !profile && (
            <div className="glass-card p-6 text-center">
              <p className="text-[0.95rem] muted">{t(lang, "grow_needs_profile")}</p>
              <PendingLink href="/grow" className="btn btn-primary mt-4">
                {t(lang, "grow_needs_profile_cta")}
              </PendingLink>
            </div>
          )}

          {/* ============ 1. FIELD STATUS ============ */}
          {profile && (
            <section aria-labelledby="field-heading">
              <h2 id="field-heading" className="eyebrow">
                {t(lang, "tea_section_field")}
              </h2>

              {grow.state === "loading" && <Skeleton className="mt-3 h-40 w-full" />}

              {grow.state === "unavailable" && (
                <div
                  className="mt-3 rounded-[var(--radius-sm)] px-4 py-3.5"
                  style={{ background: "var(--warn-soft)", borderLeft: "3px solid var(--warn)" }}
                >
                  <p className="text-[0.92rem]">{t(lang, "weather_unavailable")}</p>
                  {/* Network-layer detail, English in every language: it is a
                      diagnostic under an already-translated headline, so it is
                      marked rather than left for a Sinhala voice to mispronounce. */}
                  {grow.reason && (
                    <p className="mt-1.5 text-[0.82rem] muted" lang="en">
                      {grow.reason}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mt-3 min-h-[44px]"
                    onClick={grow.refresh}
                  >
                    {t(lang, "weather_retry")}
                  </button>
                </div>
              )}

              {grow.state === "ready" && grow.irrigation && (
                <div className="mt-3">
                  <IrrigationCard advice={grow.irrigation} lang={lang} rainfed={!profile.irrigated} />
                  {/* Cache age, stated where the number it qualifies is read.
                      `useGrowPlot` refuses anything past its freshness bound, so
                      this can only ever be a recent date. */}
                  {grow.cachedAt && (
                    <p className="mt-2 text-[0.78rem]" style={{ color: "var(--warn)" }}>
                      {t(lang, "weather_cached", {
                        date: new Date(grow.cachedAt).toLocaleDateString(),
                      })}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ============ 2. LEAF ASSESSMENT ============ */}
          {/* An unsupported crop must not receive a tea diagnosis. The capture
              control is withheld entirely rather than merely captioned, a
              warning paragraph above a working camera still lets a coconut
              grower be handed a confident Camellia sinensis disease. */}
          {profile && !teaPlot && (
            <section aria-labelledby="leaf-unsupported-heading">
              <h2 id="leaf-unsupported-heading" className="eyebrow">
                {t(lang, "tea_section_leaf")}
              </h2>
              <div
                className="mt-3 rounded-[var(--radius-sm)] px-4 py-3.5"
                style={{ background: "var(--warn-soft)", borderLeft: "3px solid var(--warn)" }}
              >
                <p className="text-[0.92rem]">
                  {t(lang, "tea_crop_unsupported", { crop: t(lang, `grow_crop_${profile.crop}`) })}
                </p>
                <PendingLink href="/grow" className="btn btn-ghost btn-sm mt-3">
                  {t(lang, "nav_grow")}
                </PendingLink>
              </div>
            </section>
          )}

          {teaPlot && (
            <div className="space-y-6">
              {!prediction && !busy && (
                <LeafCapture
                  lang={lang}
                  busy={busy}
                  onAnalyse={analyse}
                  onError={(reason) => setPrediction({ state: "error", reason })}
                />
              )}

              {/* Only the OUTCOME is live. The capture control used to sit inside
                  this region, so every state change re-announced the whole card,
                  heading, format note, buttons, before the result a farmer was
                  waiting for. Polite, not assertive: nothing here is an emergency. */}
              <div aria-live="polite" aria-busy={busy} className="space-y-6">
              {busy && (
                <section className="glass-card p-5" aria-labelledby="leaf-busy-heading">
                  <p className="eyebrow">{t(lang, "tea_section_leaf")}</p>
                  <h2 id="leaf-busy-heading" className="mt-2 text-[1.1rem] font-semibold">
                    {t(lang, "tea_analysing")}
                  </h2>
                  {/* The first run downloads the runtime and the model, which on
                      a rural connection is slow enough that silence reads as a
                      hang. Saying why costs nothing. */}
                  <p className="mt-2 text-[0.85rem] muted">{t(lang, "tea_analysing_note")}</p>
                  <Skeleton className="mt-4 h-24 w-full" />
                </section>
              )}

              {prediction && !busy && (
                <LeafAssessment
                  prediction={prediction}
                  card={card}
                  lang={lang}
                  onRetry={() => setPrediction(null)}
                />
              )}
              </div>
            </div>
          )}

          {/* ============ 3. CONDITIONS ============ */}
          {profile && grow.state === "ready" && grow.risks.length > 0 && (
            <section aria-labelledby="conditions-heading">
              <h2 id="conditions-heading" className="eyebrow">
                {t(lang, "tea_section_conditions")}
              </h2>
              <p className="mt-2 text-[0.85rem] muted" style={{ maxWidth: "54ch" }}>
                {t(lang, "risk_lede")}
              </p>
              <div className="mt-3 space-y-3">
                {grow.risks.map((r) => (
                  <RiskCard key={r.disease} risk={r} lang={lang} />
                ))}
              </div>
              <p className="mt-3 text-[0.85rem]" style={{ color: "var(--warn)" }}>
                {t(lang, "risk_not_diagnosis")}
              </p>
              {grow.observedThrough && (
                <p className="mt-2 text-[0.75rem] faint">
                  {t(lang, "weather_grid_note")}{" "}
                  {t(lang, "weather_observed_through", { date: grow.observedThrough })}
                </p>
              )}
            </section>
          )}

          {/* ============ 4-5. WHY, WHAT TO DO ============ */}
          {teaPlot && advisory && !busy && (
            <AdvisoryExplanation advisory={advisory} card={card} lang={lang} />
          )}
        </div>
      )}

      {diag && card !== "loading" && (
        <div className="mt-10">
          <DiagnosticsPanel rows={diagRows} failures={diagFailures} />
        </div>
      )}
    </main>
  );
}
