"use client";

/** EUDR, as part of the sale rather than a separate tab. */
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, MapPinned, Plus, SearchCheck, X } from "lucide-react";
import PendingLink from "@/components/motion/PendingLink";
import { t, type Lang } from "@/lib/i18n";
import { listPlots } from "@/lib/intake/store";
import { consignmentLevel, lossThresholdHa, screenPlot, type VerdictLevel } from "@/lib/eudr/verdict";
import { latestCheck } from "@/lib/eudr/check";
import { useForestCheck } from "@/lib/eudr/useForestCheck";
import { updateSale } from "@/lib/sale/store";
import type { Sale } from "@/lib/sale/types";
import type { LocalPlot } from "@/lib/intake/types";

const ForestMap = dynamic(() => import("./ForestMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-64 w-full rounded-[var(--radius-sm)] sm:h-72" />,
});

const LEVEL_STYLE: Record<VerdictLevel, { color: string; soft: string; Icon: typeof CheckCircle2 }> = {
  low: { color: "var(--accent)", soft: "var(--accent-soft)", Icon: CheckCircle2 },
  review: { color: "var(--warn)", soft: "var(--warn-soft)", Icon: HelpCircle },
  high: { color: "var(--danger)", soft: "var(--danger-soft)", Icon: AlertTriangle },
  unknown: { color: "var(--fg-muted)", soft: "var(--bg-1)", Icon: HelpCircle },
};

export default function EudrPanel({ sale, lang }: { sale: Sale; lang: Lang }) {
  const [plots, setPlots] = useState<LocalPlot[] | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    listPlots()
      .then(setPlots)
      .catch(() => setPlots([]));
  }, []);

  const attached = useMemo(
    () => (plots ?? []).filter((p) => sale.plotIds.includes(p.id)),
    [plots, sale.plotIds],
  );
  const available = (plots ?? []).filter((p) => !sale.plotIds.includes(p.id));

  const levels = sale.plotIds.map((id) => {
    const check = latestCheck(id, [sale]);
    return check ? screenPlot(check.stats).level : ("unknown" as const);
  });
  const overall = consignmentLevel(levels);

  const attach = (id: string) =>
    updateSale(sale.id, (s) => ({ ...s, plotIds: [...s.plotIds, id] }));
  const detach = (id: string) =>
    updateSale(sale.id, (s) => {
      const { [id]: _drop, ...rest } = s.eudrChecks;
      return { ...s, plotIds: s.plotIds.filter((x) => x !== id), eudrChecks: rest };
    });

  return (
    <section aria-labelledby="eudr-heading" id="eudr" className="scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{t(lang, "eudr_eyebrow")}</p>
          <h2 id="eudr-heading" className="font-display mt-1 text-[1.55rem] leading-tight">
            {t(lang, "eudr_title")}
          </h2>
          <p className="mt-1.5 text-[0.9rem] muted" style={{ maxWidth: "62ch" }}>
            {t(lang, "eudr_lede")}
          </p>
        </div>
        {sale.plotIds.length > 0 && <LevelBadge level={overall} lang={lang} consignment />}
      </div>

      {plots === null ? (
        <div className="skeleton mt-4 h-24 w-full rounded-[var(--radius)]" />
      ) : (
        <>
          {attached.length === 0 && (
            <div
              className="mt-4 rounded-[var(--radius-sm)] px-4 py-3.5 text-[0.9rem]"
              style={{ background: "var(--warn-soft)", borderLeft: "3px solid var(--warn)" }}
            >
              {t(lang, "eudr_no_plots")}
            </div>
          )}

          <ul className="mt-4 space-y-4">
            {attached.map((p) => (
              <PlotCheck key={p.id} plot={p} lang={lang} onRemove={() => detach(p.id)} />
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            {available.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost min-h-[44px] inline-flex items-center gap-2"
                onClick={() => setPicking((v) => !v)}
                aria-expanded={picking}
              >
                <Plus size={15} aria-hidden="true" /> {t(lang, "eudr_attach")}
              </button>
            )}
            <PendingLink href="/intake" className="btn btn-ghost min-h-[44px] inline-flex items-center gap-2">
              <MapPinned size={15} aria-hidden="true" /> {t(lang, "eudr_map_new")}
            </PendingLink>
          </div>

          {picking && available.length > 0 && (
            <ul className="glass-card mt-3 divide-y p-1.5" style={{ borderColor: "var(--glass-hairline)" }}>
              {available.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg px-3 text-left hover:bg-[var(--bg-1)]"
                    onClick={() => {
                      attach(p.id);
                      if (available.length === 1) setPicking(false);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[0.9rem]">{p.commodity ?? t(lang, "eudr_plot")}</span>
                      <span className="block text-[0.72rem] faint">
                        {p.computedAreaHa.toFixed(2)} ha · {p.status === "attested" ? t(lang, "eudr_attested") : t(lang, "eudr_captured")}
                      </span>
                    </span>
                    <Plus size={15} aria-hidden="true" className="shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-[0.78rem] faint" style={{ maxWidth: "70ch" }}>
            {t(lang, "eudr_method")}
          </p>
        </>
      )}
    </section>
  );
}

function PlotCheck({
  plot,
  lang,
  onRemove,
}: {
  plot: LocalPlot;
  lang: Lang;
  onRemove: () => void;
}) {
  const { check, verdict, stale, busy, run, errorMessage } = useForestCheck(plot);
  const error = errorMessage(lang);

  return (
    <li className="glass-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[0.98rem] font-semibold">{plot.commodity ?? t(lang, "eudr_plot")}</h3>
          <p className="text-[0.78rem] faint">
            {plot.computedAreaHa.toFixed(2)} ha · {plot.status === "attested" ? t(lang, "eudr_attested") : t(lang, "eudr_captured")}
          </p>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg faint hover:opacity-100"
          onClick={onRemove}
          aria-label={t(lang, "eudr_remove")}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3">
        <ForestMap
          ring={plot.ring}
          labels={{
            jrc: t(lang, "eudr_layer_jrc"),
            hansen: t(lang, "eudr_layer_hansen"),
            plot: t(lang, "eudr_map_alt"),
          }}
        />
      </div>

      {plot.status !== "attested" && (
        <p className="mt-3 text-[0.82rem]" style={{ color: "var(--warn)" }}>
          {t(lang, "eudr_not_attested")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary btn-sm min-h-[44px] inline-flex items-center gap-2"
          onClick={() => void run()}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <SearchCheck size={15} aria-hidden="true" />}
          {t(lang, check ? "eudr_recheck" : "eudr_check")}
        </button>
        {check && (
          <span className="text-[0.75rem] faint">
            {t(lang, "eudr_checked_at", { date: new Date(check.at).toLocaleDateString() })}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 text-[0.85rem]" role="alert" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {stale && (
        <p className="mt-3 text-[0.82rem]" style={{ color: "var(--warn)" }}>
          {t(lang, "eudr_stale")}
        </p>
      )}

      {verdict && check && (
        <div aria-live="polite" className="mt-4">
          <LevelBadge level={verdict.level} lang={lang} />
          <ul className="mt-3 space-y-2 text-[0.88rem]">
            {verdict.reasons.map((r) => (
              <li key={r.key} className="flex gap-2">
                <span aria-hidden="true" className="faint">
                  ·
                </span>
                <span>{t(lang, r.key, r.slots)}</span>
              </li>
            ))}
          </ul>
          {verdict.evidence.length > 0 && (
            <>
              <h4 className="mt-3 text-[0.82rem] font-semibold">{t(lang, "eudr_evidence_title")}</h4>
              <ul className="mt-1.5 space-y-1.5 text-[0.84rem] muted">
                {verdict.evidence.map((e) => (
                  <li key={e} className="flex gap-2">
                    <span aria-hidden="true">→</span>
                    <span>{t(lang, e)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-[0.8rem] font-medium muted">{t(lang, "eudr_numbers")}</summary>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[0.8rem]">
              <dt className="faint">{t(lang, "eudr_n_plot")}</dt>
              <dd className="tabular-nums">{check.stats.plotHa.toFixed(2)} ha</dd>
              <dt className="faint">{t(lang, "eudr_n_forest")}</dt>
              <dd className="tabular-nums">{check.stats.forest2020Ha.toFixed(2)} ha</dd>
              <dt className="faint">{t(lang, "eudr_n_loss_forest")}</dt>
              <dd className="tabular-nums">{check.stats.lossOnForestAfterCutoffHa.toFixed(2)} ha</dd>
              <dt className="faint">{t(lang, "eudr_n_loss_any")}</dt>
              <dd className="tabular-nums">{check.stats.lossAnyAfterCutoffHa.toFixed(2)} ha</dd>
              <dt className="faint">{t(lang, "eudr_n_threshold")}</dt>
              <dd className="tabular-nums">{lossThresholdHa(check.stats.plotHa).toFixed(2)} ha</dd>
            </dl>
            <p className="mt-2 text-[0.72rem] faint">
              {check.stats.versions.jrc} · {check.stats.versions.hansen}
            </p>
          </details>
        </div>
      )}
    </li>
  );
}

function LevelBadge({ level, lang, consignment }: { level: VerdictLevel; lang: Lang; consignment?: boolean }) {
  const st = LEVEL_STYLE[level];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.82rem] font-semibold"
      style={{ background: st.soft, color: st.color }}
    >
      <st.Icon size={15} aria-hidden="true" />
      {consignment ? t(lang, "eudr_consignment") + " · " : ""}
      {t(lang, `eudr_level_${level}`)}
    </span>
  );
}
