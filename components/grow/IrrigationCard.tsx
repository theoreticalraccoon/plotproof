"use client";

/** The watering instruction. */
import { Droplets } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import { IRRIGATION_SOURCE } from "@/lib/grow/irrigation";
import { fallbackLang } from "@/lib/grow/tea/display";
import type { IrrigationAdvice, IrrigationVerdict } from "@/lib/grow/types";

const TONE: Record<IrrigationVerdict, { color: string; soft: string }> = {
  no_action: { color: "var(--accent)", soft: "var(--accent-soft)" },
  water_soon: { color: "var(--warn)", soft: "var(--warn-soft)" },
  water_now: { color: "var(--danger)", soft: "var(--danger-soft)" },
  waterlogged: { color: "var(--info)", soft: "var(--info-soft)" },
};

export default function IrrigationCard({
  advice,
  lang,
  rainfed,
}: {
  advice: IrrigationAdvice;
  lang: Lang;
  rainfed: boolean;
}) {
  const tone = TONE[advice.verdict];
  const showQuantity = advice.recommendedMm > 0;

  return (
    <section className="glass-card p-5" aria-labelledby="irrigation-heading">
      <p className="eyebrow flex items-center gap-2">
        <Droplets size={13} aria-hidden="true" style={{ color: tone.color }} />
        {t(lang, "irrigation_title")}
      </p>

      <h2
        id="irrigation-heading"
        className="mt-3 text-[1.35rem] font-semibold leading-tight"
        style={{ color: tone.color }}
      >
        {t(lang, `irrigation_${advice.verdict}`)}
      </h2>

      <p
        className="mt-2.5 text-[0.95rem] leading-relaxed"
        {...fallbackLang(lang, advice.reasonKey)}
      >
        {t(lang, advice.reasonKey, advice.reasonSlots)}
      </p>

      {showQuantity && (
        <p
          className="mt-4 rounded-[var(--radius-sm)] px-3.5 py-3 text-[0.95rem] font-medium"
          style={{ background: tone.soft, color: tone.color }}
          {...fallbackLang(lang, "irrigation_apply")}
        >
          {t(lang, "irrigation_apply", {
            mm: advice.recommendedMm,
            litres: advice.recommendedLitres.toLocaleString(),
          })}
        </p>
      )}

      {/* A rainfed plot cannot act on a watering instruction, so we reframe it
          as a stress warning instead of telling someone to do the impossible. */}
      {showQuantity && rainfed && (
        <p className="mt-2.5 text-[0.85rem] muted" {...fallbackLang(lang, "irrigation_rainfed_note")}>
          {t(lang, "irrigation_rainfed_note")}
        </p>
      )}

      {/*
        Which evidence set the soil state. Shown always, not just when a sensor
        is attached: a farmer deciding whether to act on "water now" should know
        whether anything actually touched their soil, or whether this is a
        regional model talking. The accent dot marks the one tier that is a real
        measurement.
      */}
      <p className="mt-4 flex items-start gap-2 text-[0.8rem] faint">
        <span
          aria-hidden="true"
          className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background:
              advice.anchorSource === "sensor" ? "var(--accent)" : "var(--fg-faint)",
          }}
        />
        <span>{t(lang, `irrigation_anchor_${advice.anchorSource}`)}</span>
      </p>

      <hr className="hairline mt-4" />
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.8rem]">
        <dt className="faint">{t(lang, "irrigation_taw_label")}</dt>
        <dd className="text-right tabular-nums">{t(lang, "irrigation_mm", { mm: advice.tawMm })}</dd>
        <dt className="faint">{t(lang, "irrigation_raw_label")}</dt>
        <dd className="text-right tabular-nums">
          {t(lang, "irrigation_mm_used", { mm: advice.rawMm })}
        </dd>
      </dl>
      <p className="mt-3 text-[0.75rem] faint">
        {t(lang, "irrigation_method")} · {IRRIGATION_SOURCE.name}
      </p>
    </section>
  );
}
