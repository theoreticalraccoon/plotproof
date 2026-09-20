"use client";

/** The plot picker, the no-plots card and the weather-down notice, shared by the GROW pages. */
import PendingLink from "@/components/motion/PendingLink";
import { t, type Lang } from "@/lib/i18n";
import type { GrowData } from "@/lib/grow/useGrowPlot";
import type { LocalPlot } from "@/lib/intake/types";

export function PlotPicker({
  plots,
  selectedId,
  onSelect,
  lang,
  id,
  className = "",
}: {
  plots: LocalPlot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  lang: Lang;
  id: string;
  className?: string;
}) {
  if (plots.length < 2) return null;
  return (
    <section aria-labelledby={id} className={className}>
      <h2 id={id} className="label">
        {t(lang, "grow_pick_plot")}
      </h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {plots.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            aria-pressed={p.id === selectedId}
            className={p.id === selectedId ? "chip chip-active" : "chip"}
          >
            {p.commodity ?? p.id.slice(0, 8)} · {p.computedAreaHa.toFixed(2)} ha
          </button>
        ))}
      </div>
    </section>
  );
}

/** No plots at all: send the officer to capture one rather than showing an empty dashboard. */
export function NoPlots({ lang }: { lang: Lang }) {
  return (
    <div className="glass-card mt-8 p-6 text-center">
      <p className="text-[0.95rem] muted">{t(lang, "grow_no_plots")}</p>
      <PendingLink href="/intake" className="btn btn-primary mt-4">
        {t(lang, "grow_no_plots_cta")}
      </PendingLink>
    </div>
  );
}

/** Weather down and nothing cached. The reason is network detail, kept in English. */
export function WeatherUnavailable({ grow, lang, className = "" }: { grow: GrowData; lang: Lang; className?: string }) {
  return (
    <div
      className={`rounded-[var(--radius-sm)] px-4 py-3.5 ${className}`}
      style={{ background: "var(--warn-soft)", borderLeft: "3px solid var(--warn)" }}
    >
      <p className="text-[0.92rem]">{t(lang, "weather_unavailable")}</p>
      {grow.reason && (
        <p className="mt-1.5 text-[0.82rem] muted" lang="en">
          {grow.reason}
        </p>
      )}
      <button type="button" className="btn btn-ghost btn-sm mt-3 min-h-[44px]" onClick={grow.refresh}>
        {t(lang, "weather_retry")}
      </button>
    </div>
  );
}
