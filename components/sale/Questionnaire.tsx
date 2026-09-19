"use client";

/** The sale questionnaire: everything the export documents need, on one page. */
import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import { fieldsFor } from "@/lib/sale/fields";
import { issuesBySection, saleIssues, type SaleSection } from "@/lib/sale/model";
import type { Sale } from "@/lib/sale/types";
import SaleField from "./SaleField";

/** The sections the questionnaire shows. EUDR has its own panel. */
const FORM_SECTIONS: SaleSection[] = ["exporter", "buyer", "product", "packing", "commercial", "shipment"];

export default function Questionnaire({ sale, lang }: { sale: Sale; lang: Lang }) {
  const bySection = issuesBySection(saleIssues(sale));
  const [showAll, setShowAll] = useState(false);
  const remaining = FORM_SECTIONS.reduce((n, s) => n + bySection[s].length, 0);

  return (
    <section aria-labelledby="q-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="q-heading" className="font-display text-[1.55rem] leading-tight">
            {t(lang, "sale_q_title")}
          </h2>
          <p className="mt-1.5 text-[0.9rem] muted" style={{ maxWidth: "58ch" }}>
            {t(lang, "sale_q_lede")}
          </p>
        </div>
        {remaining > 0 ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm min-h-[40px]"
            onClick={() => setShowAll(true)}
            aria-pressed={showAll}
          >
            {t(lang, "sale_q_show_missing", { n: remaining })}
          </button>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-[0.85rem] font-medium" style={{ color: "var(--accent)" }}>
            <CheckCircle2 size={16} aria-hidden="true" /> {t(lang, "sale_q_complete")}
          </p>
        )}
      </div>

      <ol className="mt-5 space-y-4">
        {FORM_SECTIONS.map((section, i) => {
          const issues = bySection[section];
          const errorFor = (path: string) => issues.find((x) => x.field === path)?.messageKey;
          const done = issues.length === 0;
          return (
            <li key={section} id={`sale-${section}`} className="glass-card scroll-mt-28 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2.5 text-[1.02rem] font-semibold">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[0.72rem]"
                    style={{
                      background: done ? "var(--accent)" : "var(--bg-1)",
                      color: done ? "var(--accent-fg)" : "var(--fg-muted)",
                    }}
                    aria-hidden="true"
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  {t(lang, `sale_s_${section}`)}
                </h3>
                <span className="shrink-0 text-[0.78rem]" style={{ color: done ? "var(--accent)" : "var(--fg-faint)" }}>
                  {done ? (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 size={13} aria-hidden="true" /> {t(lang, "sale_s_done")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Circle size={11} aria-hidden="true" /> {t(lang, "sale_s_left", { n: issues.length })}
                    </span>
                  )}
                </span>
              </div>
              {section !== "product" && (
                <p className="mt-1.5 text-[0.82rem] faint">{t(lang, `sale_s_${section}_hint`)}</p>
              )}
              <div className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2">
                {fieldsFor(section).map((def) => (
                  <SaleField
                    key={def.path}
                    def={def}
                    sale={sale}
                    lang={lang}
                    errorKey={errorFor(def.path)}
                    forceError={showAll}
                  />
                ))}
              </div>
              {section === "buyer" && sale.buyer.country && (
                <p className="mt-3 text-[0.82rem] muted">
                  {t(lang, "sale_market_note", { market: t(lang, `market_${sale.destination.toLowerCase()}`) })}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
