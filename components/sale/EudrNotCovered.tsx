"use client";

/** Says why this shipment gets no deforestation check, instead of leaving the section out silently. */
import { CheckCircle2 } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import { saleProduct } from "@/lib/sale/model";
import type { Sale } from "@/lib/sale/types";

export default function EudrNotCovered({ sale, lang }: { sale: Sale; lang: Lang }) {
  const product = saleProduct(sale);
  if (!product) return null;
  // Two different reasons, and the officer is told which one applies.
  const offList = !product.eudrCovered;

  return (
    <section aria-labelledby="eudr-nc-heading" id="eudr" className="scroll-mt-28">
      <p className="eyebrow">{t(lang, "eudr_eyebrow")}</p>
      <h2 id="eudr-nc-heading" className="font-display mt-1 text-[1.55rem] leading-tight">
        {t(lang, "eudr_nc_title")}
      </h2>
      <div
        className="mt-4 flex gap-3 rounded-[var(--radius-sm)] px-4 py-3.5"
        style={{ background: "var(--accent-soft)", borderLeft: "3px solid var(--accent)" }}
      >
        <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
        <div className="text-[0.9rem] leading-relaxed" style={{ maxWidth: "62ch" }}>
          {offList ? (
            <>
              <p>{t(lang, "eudr_nc_annex")}</p>
              <p className="mt-1.5">{t(lang, "eudr_nc_product", { product: product.name })}</p>
            </>
          ) : (
            <p>{t(lang, "eudr_nc_destination")}</p>
          )}
          <p className="mt-1.5 faint">{t(lang, "eudr_nc_why")}</p>
        </div>
      </div>
    </section>
  );
}
