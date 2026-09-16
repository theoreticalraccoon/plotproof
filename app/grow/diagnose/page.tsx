"use client";

/**
 * /grow/diagnose — photograph a leaf, get an advisory.
 *
 * The full path: plot → grow profile → leaf photo → preprocessing → CNN →
 * calibration → abstention → evidence layer → advisory.
 *
 * This component orchestrates and renders. It holds no model constants: the
 * threshold, temperature, class names and limitations all arrive from the
 * published card through `lib/grow/tea/`. It also reuses the EXISTING weather,
 * irrigation and risk results via `useGrowPlot` rather than recomputing them —
 * the Day 1 engines are untouched and simply read.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Leaf } from "lucide-react";
import Breadcrumb from "@/components/shell/Breadcrumb";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PendingLink from "@/components/motion/PendingLink";
import Reveal from "@/components/motion/Reveal";
import { Skeleton } from "@/components/motion/Skeleton";
import LeafCapture from "@/components/grow/LeafCapture";
import DiagnosisResult from "@/components/grow/DiagnosisResult";
import { t, useLang } from "@/lib/i18n";
import { listPlots } from "@/lib/intake/store";
import { getGrowProfile } from "@/lib/grow/store";
import { useGrowPlot } from "@/lib/grow/useGrowPlot";
import { loadTeaCard } from "@/lib/grow/tea/card";
import { classifyLeaf } from "@/lib/grow/tea/infer";
import { buildAdvisory } from "@/lib/grow/tea/evidence";
import type { TeaAdvisory, TeaModelCard, TeaPrediction } from "@/lib/grow/tea/types";
import type { GrowProfile } from "@/lib/grow/types";
import type { LocalPlot } from "@/lib/intake/types";

export default function DiagnosePage() {
  const lang = useLang();
  const [plots, setPlots] = useState<LocalPlot[] | null>(null);
  const [plotId, setPlotId] = useState<string | null>(null);
  const [profile, setProfile] = useState<GrowProfile | null>(null);
  const [card, setCard] = useState<TeaModelCard | null | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [prediction, setPrediction] = useState<TeaPrediction | null>(null);

  useEffect(() => {
    listPlots()
      .then((p) => {
        setPlots(p);
        if (p.length > 0) setPlotId((cur) => cur ?? p[0].id);
      })
      .catch(() => setPlots([]));
    void loadTeaCard().then(setCard);
  }, []);

  useEffect(() => {
    if (!plotId) return;
    getGrowProfile(plotId).then((p) => setProfile(p ?? null)).catch(() => setProfile(null));
  }, [plotId]);

  const plot = plots?.find((p) => p.id === plotId) ?? null;
  // Reads the existing engines. Nothing here recomputes weather, irrigation or risk.
  const grow = useGrowPlot(plot, profile);

  const analyse = useCallback(async (img: HTMLImageElement) => {
    setBusy(true);
    setPrediction(null);
    try {
      const { prediction: p } = await classifyLeaf(img);
      setPrediction(p);
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

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: t(lang, "nav_home"), href: "/" },
            { label: t(lang, "nav_grow"), href: "/grow" },
            { label: t(lang, "tea_title") },
          ]}
        />
        <LanguageSwitcher />
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

          {/* The audit found that 47 of 60 tea_* strings fall back to English —
              including every action line. That is the deliberate policy (D-016:
              never machine-translate an instruction a farmer acts on), but it
              was silent. A Sinhala or Tamil reader is now told so in their own
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

      {card && card !== "loading" && plots && plots.length > 0 && (
        <div className="mt-8 space-y-6">
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
                    onClick={() => setPlotId(p.id)}
                    aria-pressed={p.id === plotId}
                    className={p.id === plotId ? "chip chip-active" : "chip"}
                  >
                    {p.commodity ?? p.id.slice(0, 8)} · {p.computedAreaHa.toFixed(2)} ha
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* INVARIANT 7: an unsupported crop must not receive a tea diagnosis.
              The audit found this was only a warning paragraph above a working
              camera — a coconut grower could photograph a leaf and be handed a
              confident Camellia sinensis disease. The capture control is now
              withheld entirely, not merely captioned. */}
          {profile && !teaPlot && (
            <div
              className="rounded-[var(--radius-sm)] px-4 py-3.5"
              style={{ background: "var(--warn-soft)", borderLeft: "3px solid var(--warn)" }}
            >
              <p className="text-[0.92rem]">
                {t(lang, "tea_crop_unsupported", { crop: t(lang, `grow_crop_${profile.crop}`) })}
              </p>
              <PendingLink href="/grow" className="btn btn-ghost btn-sm mt-3">
                {t(lang, "nav_grow")}
              </PendingLink>
            </div>
          )}

          {teaPlot && (
            <LeafCapture
              lang={lang}
              busy={busy}
              onAnalyse={analyse}
              onError={(reason) => setPrediction({ state: "error", reason })}
            />
          )}

          {busy && <Skeleton className="h-48 w-full" />}

          {teaPlot && advisory && !busy && (
            <DiagnosisResult
              advisory={advisory}
              card={card}
              lang={lang}
              onRetry={() => setPrediction(null)}
            />
          )}
        </div>
      )}
    </main>
  );
}
