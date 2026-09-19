"use client";

/** Section 2 of the advisory: what the photograph says, and nothing else. */
import { AlertTriangle, Camera, HelpCircle } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import { localisedClassName } from "@/lib/grow/tea/display";
import { crossDatasetDeclineRate } from "@/lib/grow/tea/card";
import type { TeaModelCard, TeaPrediction } from "@/lib/grow/tea/types";

const PHOTO_TIPS = [
  "tea_tip_light",
  "tea_tip_one_leaf",
  "tea_tip_focus",
  "tea_tip_shadow",
  "tea_tip_retake",
] as const;

export default function LeafAssessment({
  prediction,
  card,
  lang,
  onRetry,
}: {
  prediction: TeaPrediction;
  /** Only for the published abstention rate. No decision is taken from it here. */
  card: TeaModelCard | null;
  lang: Lang;
  onRetry: () => void;
}) {
  const declineRate = card ? crossDatasetDeclineRate(card) : null;

  if (prediction.state === "confident") {
    const name = localisedClassName(lang, prediction.classKey, prediction.displayName);
    return (
      <section className="glass-card p-5" aria-labelledby="leaf-heading">
        <p className="eyebrow flex items-center gap-2">
          <Camera size={13} aria-hidden="true" style={{ color: "var(--accent)" }} />
          {t(lang, "tea_section_leaf")}
        </p>
        <h2 id="leaf-heading" className="mt-2 text-[1.45rem] font-semibold leading-tight">
          {name}
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

        {/* The limitation that must never be implied away. Blister blight and
            red rust appear in no external test set, so the model has never been
            checked on them outside the data it learned from. */}
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
                <span className="min-w-0 muted">{localisedClassName(lang, d.key, d.displayName)}</span>
                <span className="shrink-0 tabular-nums faint">
                  {(d.probability * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </details>

        <button type="button" className="btn btn-ghost btn-sm mt-4 min-h-[44px]" onClick={onRetry}>
          {t(lang, "tea_check_another")}
        </button>
      </section>
    );
  }

  if (prediction.state === "uncertain") {
    return (
      <section
        className="rounded-[var(--radius)] p-5"
        style={{ background: "var(--warn-soft)", borderLeft: "3px solid var(--warn)" }}
        aria-labelledby="leaf-heading"
      >
        <p className="flex items-center gap-2 eyebrow" style={{ color: "var(--warn)" }}>
          <HelpCircle size={13} aria-hidden="true" />
          {t(lang, "tea_section_leaf")}
        </p>
        {/* No class is rendered here. There is none on the prediction to render. */}
        <h2
          id="leaf-heading"
          className="mt-2 text-[1.3rem] font-semibold"
          style={{ color: "var(--warn)" }}
        >
          {t(lang, "tea_state_uncertain")}
        </h2>
        <p className="mt-2.5 text-[0.9rem]" style={{ maxWidth: "58ch" }}>
          {t(lang, "tea_uncertain_body")}
        </p>

        {/* Abstention is the thing most likely to be read as breakage: at the
            published threshold the model answers only about a third of real
            field photographs, so a farmer will meet this screen far more often
            than an answer. The rate is read off the card, never written here,
            and the sentence is omitted entirely if the card does not publish
            coverage, saying less rather than inventing a number. */}
        {declineRate !== null && (
          <p className="mt-2.5 text-[0.85rem]" style={{ maxWidth: "58ch" }}>
            {t(lang, "tea_uncertain_expected", { pct: Math.round(declineRate * 100) })}
          </p>
        )}

        <h3 className="mt-4 text-[0.85rem] font-semibold">{t(lang, "tea_photo_tips_title")}</h3>
        <ul className="mt-2 space-y-1.5 text-[0.85rem]">
          {PHOTO_TIPS.map((k) => (
            <li key={k} className="flex gap-2">
              <span aria-hidden="true">·</span>
              <span>{t(lang, k)}</span>
            </li>
          ))}
        </ul>

        <button type="button" className="btn btn-primary btn-sm mt-4 min-h-[44px]" onClick={onRetry}>
          {t(lang, "tea_retake")}
        </button>
      </section>
    );
  }

  return (
    <section
      className="rounded-[var(--radius)] p-5"
      style={{ background: "var(--danger-soft)", borderLeft: "3px solid var(--danger)" }}
      aria-labelledby="leaf-heading"
    >
      <p className="flex items-center gap-2 eyebrow" style={{ color: "var(--danger)" }}>
        <AlertTriangle size={13} aria-hidden="true" />
        {t(lang, "tea_section_leaf")}
      </p>
      {/* Deliberately distinct from "uncertain", in wording and in colour: the
          model did not decline, it never ran. Telling a farmer to retake a
          photo when the real problem is a failed download wastes their time and
          misattributes the fault to them. */}
      <h2 id="leaf-heading" className="mt-2 text-[1.1rem] font-semibold">
        {t(lang, "tea_state_error")}
      </h2>
      <p className="mt-2 text-[0.92rem]">{t(lang, `tea_error_${prediction.reason}`)}</p>
      <p className="mt-2 text-[0.85rem] muted">{t(lang, "tea_error_still_useful")}</p>
      <button type="button" className="btn btn-ghost btn-sm mt-3 min-h-[44px]" onClick={onRetry}>
        {t(lang, "tea_try_again")}
      </button>
    </section>
  );
}
