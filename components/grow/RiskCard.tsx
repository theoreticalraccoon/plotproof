"use client";

/**
 * One disease, its infection-pressure score, and — non-negotiably — WHY.
 *
 * The "why" is not a nicety. An unexplained risk number is exactly the kind of
 * output this project refuses to ship: a farmer cannot check it, an agronomist
 * cannot challenge it, and neither can tell it apart from a guess. So every
 * card names the measured conditions that produced the score, and the pathogen
 * biology that makes those conditions matter.
 *
 * The score is rendered as a band plus a bar, never as a bare "0.72" — the same
 * reason the public map used plain-language confidence rather than raw
 * probabilities.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import { diseaseBasis } from "@/lib/grow/risk";
import type { DiseaseRisk, RiskBand } from "@/lib/grow/types";

const BAND_COLOR: Record<RiskBand, string> = {
  low: "var(--accent)",
  moderate: "var(--warn)",
  high: "var(--danger)",
};

export default function RiskCard({ risk, lang }: { risk: DiseaseRisk; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const color = BAND_COLOR[risk.band];

  return (
    <article className="glass p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.98rem] font-semibold">
          {t(lang, `risk_disease_${risk.disease}`)}
        </h3>
        <span className="text-[0.85rem] font-semibold" style={{ color }}>
          {t(lang, `risk_band_${risk.band}`)}
        </span>
      </div>

      {/* The bar is the score; the number itself is deliberately not printed. */}
      <div
        className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--glass-hairline)" }}
        role="img"
        aria-label={`${t(lang, `risk_disease_${risk.disease}`)}: ${t(lang, `risk_band_${risk.band}`)}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.round(risk.score * 100)}%`, background: color }}
        />
      </div>

      <p className="mt-2 text-[0.8rem] faint">
        {t(lang, "risk_days", { days: risk.favourableDays, window: risk.windowDays })}
      </p>

      {risk.drivers.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-3 inline-flex items-center gap-1.5 text-[0.82rem] font-medium transition-colors duration-150"
            style={{ color: "var(--fg-muted)" }}
          >
            {t(lang, "risk_why")}
            <ChevronDown
              size={14}
              aria-hidden="true"
              style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
            />
          </button>

          {open && (
            <div className="mt-3 border-l-2 pl-3.5" style={{ borderColor: "var(--glass-hairline)" }}>
              <ul className="space-y-1.5 text-[0.85rem]">
                {risk.drivers.map((d) => (
                  <li key={d.key}>{t(lang, d.key, d.slots)}</li>
                ))}
              </ul>
              <p className="mt-3 text-[0.78rem] faint">
                <span className="font-medium">{t(lang, "risk_basis")}:</span>{" "}
                {diseaseBasis(risk.disease)}
              </p>
            </div>
          )}
        </>
      )}
    </article>
  );
}
