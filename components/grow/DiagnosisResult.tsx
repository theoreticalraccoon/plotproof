"use client";

/**
 * Renders the advisory: what the photo suggests, what conditions suggest, what
 * was actually observed, and what to do next.
 *
 * Presentation only. Every model fact — class names, confidence, threshold,
 * version, limitations — arrives already resolved from the card via
 * `lib/grow/tea/`. Nothing here knows the number 0.9976, and nothing here can
 * bypass it: the "uncertain" branch has no class to render even if it wanted to.
 */
import { AlertTriangle, Camera, CloudSun, HelpCircle, Ruler, Sprout } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import type { EvidenceSource, TeaAdvisory, TeaModelCard } from "@/lib/grow/tea/types";

const SOURCE_META: Record<EvidenceSource, { Icon: typeof Camera; labelKey: string }> = {
  image: { Icon: Camera, labelKey: "tea_src_image" },
  environment: { Icon: Sprout, labelKey: "tea_src_environment" },
  sensor: { Icon: Ruler, labelKey: "tea_src_sensor" },
  weather: { Icon: CloudSun, labelKey: "tea_src_weather" },
};

const STANCE_COLOR: Record<string, string> = {
  supports: "var(--accent)",
  tension: "var(--warn)",
  neutral: "var(--fg-faint)",
  observation: "var(--info)",
};

const PHOTO_TIPS = [
  "tea_tip_light",
  "tea_tip_one_leaf",
  "tea_tip_focus",
  "tea_tip_shadow",
  "tea_tip_retake",
] as const;

export default function DiagnosisResult({
  advisory,
  card,
  lang,
  onRetry,
}: {
  advisory: TeaAdvisory;
  card: TeaModelCard | null;
  lang: Lang;
  onRetry: () => void;
}) {
  const { prediction } = advisory;

  return (
    <div className="space-y-6">
      {/* ---------- 1. WHAT THE PHOTO SUGGESTS ---------- */}
      {prediction.state === "confident" && (
        <section className="glass-card p-5" aria-labelledby="dx-heading">
          <p className="eyebrow">{t(lang, "tea_state_confident")}</p>
          <h2 id="dx-heading" className="mt-2 text-[1.45rem] font-semibold leading-tight">
            {prediction.displayName}
          </h2>
          <p className="mt-1.5 text-[0.9rem] muted">
            {t(lang, "tea_confidence", { pct: Math.round(prediction.confidence * 100) })}
            {" · "}
            {t(lang, "tea_model_version", { version: prediction.modelVersion })}
          </p>

          {/* Confidence is not P(correct). Said every time, next to the number. */}
          <p className="mt-3 text-[0.82rem] muted" style={{ maxWidth: "58ch" }}>
            {t(lang, "tea_confidence_caveat")}
          </p>

          {/* The limitation that must never be implied away. */}
          {!prediction.crossDatasetValidated && (
            <p
              className="mt-3 rounded-[var(--radius-sm)] px-3.5 py-3 text-[0.85rem]"
              style={{ background: "var(--warn-soft)", borderLeft: "3px solid var(--warn)" }}
            >
              {t(lang, "tea_not_cross_validated")}
            </p>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer text-[0.85rem] font-medium muted">
              {t(lang, "tea_other_possibilities")}
            </summary>
            <ul className="mt-3 space-y-1.5">
              {prediction.distribution.slice(1).map((d) => (
                <li key={d.key} className="flex items-baseline justify-between gap-3 text-[0.85rem]">
                  <span className="muted">{d.displayName}</span>
                  <span className="tabular-nums faint">{(d.probability * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {prediction.state === "uncertain" && (
        <section
          className="rounded-[var(--radius)] p-5"
          style={{ background: "var(--warn-soft)", borderLeft: "3px solid var(--warn)" }}
          aria-labelledby="dx-heading"
        >
          <p className="flex items-center gap-2 eyebrow" style={{ color: "var(--warn)" }}>
            <HelpCircle size={13} aria-hidden="true" />
            {t(lang, "tea_src_image")}
          </p>
          {/* No class is rendered here. There is none to render. */}
          <h2 id="dx-heading" className="mt-2 text-[1.3rem] font-semibold" style={{ color: "var(--warn)" }}>
            {t(lang, "tea_state_uncertain")}
          </h2>
          <p className="mt-2.5 text-[0.9rem]" style={{ maxWidth: "58ch" }}>
            {t(lang, "tea_uncertain_body")}
          </p>

          <h3 className="mt-4 text-[0.85rem] font-semibold">{t(lang, "tea_photo_tips_title")}</h3>
          <ul className="mt-2 space-y-1.5 text-[0.85rem]">
            {PHOTO_TIPS.map((k) => (
              <li key={k} className="flex gap-2">
                <span aria-hidden="true">·</span>
                <span>{t(lang, k)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {prediction.state === "error" && (
        <section
          className="rounded-[var(--radius)] p-5"
          style={{ background: "var(--danger-soft)", borderLeft: "3px solid var(--danger)" }}
          aria-labelledby="dx-heading"
        >
          <p className="flex items-center gap-2 eyebrow" style={{ color: "var(--danger)" }}>
            <AlertTriangle size={13} aria-hidden="true" />
            {t(lang, "tea_state_error")}
          </p>
          {/* Deliberately distinct from "uncertain": the model did not decline,
              it never ran. Telling a farmer to retake a photo would be wrong. */}
          <p id="dx-heading" className="mt-2 text-[0.95rem] font-medium">
            {t(lang, `tea_error_${prediction.reason}`)}
          </p>
          <p className="mt-2 text-[0.85rem] muted">{t(lang, "tea_error_still_useful")}</p>
          <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={onRetry}>
            {t(lang, "tea_try_again")}
          </button>
        </section>
      )}

      {/* ---------- 2-3. THE EVIDENCE, EACH LINE NAMING ITS SOURCE ---------- */}
      <section aria-labelledby="ev-heading">
        <h2 id="ev-heading" className="eyebrow">
          {t(lang, "tea_evidence_title")}
        </h2>
        <ul className="mt-3 space-y-3">
          {advisory.evidence.map((e, i) => {
            const meta = SOURCE_META[e.source];
            const color = STANCE_COLOR[e.stance] ?? "var(--fg-faint)";
            return (
              <li key={`${e.messageKey}-${i}`} className="glass flex gap-3 p-3.5">
                <meta.Icon
                  size={15}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                  style={{ color }}
                />
                <div className="min-w-0">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em]" style={{ color }}>
                    {t(lang, meta.labelKey)}
                  </p>
                  <p className="mt-1 text-[0.88rem] leading-relaxed">{t(lang, e.messageKey, e.slots)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------- 4. WHAT TO DO NEXT ---------- */}
      <section className="glass-card p-5" aria-labelledby="action-heading">
        <h2 id="action-heading" className="eyebrow">
          {t(lang, "tea_action_title")}
        </h2>
        <p className="mt-2.5 text-[0.95rem] leading-relaxed">
          {t(lang, advisory.actionKey, advisory.actionSlots)}
        </p>
        <p className="mt-3 text-[0.82rem]" style={{ color: "var(--warn)" }}>
          {t(lang, "tea_no_pesticide")}
        </p>
      </section>

      {/* Limitations come from the card, so correcting one is a JSON edit. */}
      {card && card.known_limitations.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[0.85rem] font-medium muted">
            {t(lang, "tea_limitations_title")}
          </summary>
          <ul
            className="mt-3 space-y-2 border-l-2 pl-4 text-[0.82rem] muted"
            style={{ borderColor: "var(--glass-hairline)" }}
          >
            {card.known_limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
