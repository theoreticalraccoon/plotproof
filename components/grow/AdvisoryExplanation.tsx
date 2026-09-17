"use client";

/**
 * Sections 4 and 5 of the advisory: **why**, then **what to do**.
 *
 * The "why" is the part that makes the rest legitimate. Each line names where
 * it came from — a photograph, a weather model, a calculation, or something
 * actually measured in the soil — because the whole design rests on the farmer
 * being able to tell an observation from an inference. Losing that distinction
 * would turn four honest statements into one unaccountable verdict.
 *
 * There is deliberately no combined score anywhere in this component. A CNN
 * posterior over classes and a fuzzy infection-pressure index are not
 * commensurable; averaging them produces a number that means nothing and hides
 * the disagreement that is the most useful thing on the screen.
 */
import { Calculator, Camera, CloudSun, Ruler } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import { fallbackLang, renderEvidence } from "@/lib/grow/tea/display";
import type { EvidenceSource, TeaAdvisory, TeaModelCard } from "@/lib/grow/tea/types";

/**
 * The four provenance tiers: the SOURCE the line came from, and the KIND of
 * claim it is.
 *
 * Both are needed and neither repeats the other. "Soil sensor · measured here"
 * and "Weather model · outside estimate" are the difference between a probe in
 * this plot and a land-surface model for the district, and a farmer deciding
 * whether to irrigate deserves to know which one is talking.
 */
const SOURCE_META: Record<
  EvidenceSource,
  { Icon: typeof Camera; labelKey: string; kindKey: string }
> = {
  image: { Icon: Camera, labelKey: "tea_src_image", kindKey: "tea_kind_inferred" },
  environment: { Icon: Calculator, labelKey: "tea_src_environment", kindKey: "tea_kind_calculated" },
  sensor: { Icon: Ruler, labelKey: "tea_src_sensor", kindKey: "tea_kind_measured" },
  weather: { Icon: CloudSun, labelKey: "tea_src_weather", kindKey: "tea_kind_estimated" },
};

const STANCE_COLOR: Record<string, string> = {
  supports: "var(--accent)",
  tension: "var(--warn)",
  neutral: "var(--fg-faint)",
  observation: "var(--info)",
};

export default function AdvisoryExplanation({
  advisory,
  card,
  lang,
}: {
  advisory: TeaAdvisory;
  card: TeaModelCard | null;
  lang: Lang;
}) {
  return (
    <>
      {/* ---------- 4. WHY ---------- */}
      <section aria-labelledby="why-heading">
        <h2 id="why-heading" className="eyebrow">
          {t(lang, "tea_section_why")}
        </h2>
        <p className="mt-2 text-[0.85rem] muted" style={{ maxWidth: "54ch" }}>
          {t(lang, "tea_why_lede")}
        </p>
        <ul className="mt-3 space-y-3">
          {advisory.evidence.map((e, i) => {
            const meta = SOURCE_META[e.source];
            const color = STANCE_COLOR[e.stance] ?? "var(--fg-faint)";
            return (
              <li key={`${e.messageKey}-${i}`} className="glass flex gap-3 p-3.5">
                <meta.Icon size={15} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color }} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className="text-[0.7rem] font-semibold uppercase tracking-[0.14em]"
                      style={{ color }}
                    >
                      {t(lang, meta.labelKey)}
                    </span>
                    <span className="text-[0.7rem] faint">{t(lang, meta.kindKey)}</span>
                  </p>
                  <p
                    className="mt-1 text-[0.88rem] leading-relaxed"
                    {...fallbackLang(lang, e.messageKey)}
                  >
                    {renderEvidence(lang, e)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------- 5. WHAT TO DO ---------- */}
      <section className="glass-card p-5" aria-labelledby="action-heading">
        <h2 id="action-heading" className="eyebrow">
          {t(lang, "tea_action_title")}
        </h2>
        <p
          className="mt-2.5 text-[0.95rem] leading-relaxed"
          {...fallbackLang(lang, advisory.actionKey)}
        >
          {t(lang, advisory.actionKey, advisory.actionSlots)}
        </p>
        {/* The app never names a pesticide or a dose, the same way it never
            invents law. Registration and MRLs are the Office of the Registrar
            of Pesticides' to state, not ours. */}
        <p className="mt-3 text-[0.82rem]" style={{ color: "var(--warn)" }}>
          {t(lang, "tea_no_pesticide")}
        </p>
      </section>

      {/* Limitations come from the card, so correcting one is a JSON edit and
          never a code change. */}
      {card && card.known_limitations.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[0.85rem] font-medium muted">
            {t(lang, "tea_limitations_title")}
          </summary>
          <ul
            className="mt-3 space-y-2 border-l-2 pl-4 text-[0.82rem] muted"
            style={{ borderColor: "var(--glass-hairline)" }}
          >
            {/* Card prose, English in every language — it is the model card's
                own wording and translating it would be restating the card. */}
            {card.known_limitations.map((l) => (
              <li key={l} lang="en">
                {l}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
