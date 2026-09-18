"use client";

/**
 * /sell — the export certification officer's workspace for one consignment.
 *
 * Top to bottom, the order the work actually happens in:
 *
 *   1. Questionnaire      — everything the documents need, on one page
 *   2. EUDR               — only for covered crops going to the EU
 *   3. Our documents      — invoice, packing list, certificate-of-origin draft
 *   4. Authority documents — what an authority must issue, with who and how
 *
 * and beside it, the assistant, which can see this sale and answers questions
 * about getting it exported.
 *
 * Everything reads from one sale in the store, so filling a field in the
 * questionnaire updates every document at once, and "New sale" starts the next
 * consignment without disturbing this one.
 */
import { FilePlus2 } from "lucide-react";
import Breadcrumb from "@/components/shell/Breadcrumb";
import PriceCard from "@/components/sell/PriceCard";
import SaleBar from "@/components/sale/SaleBar";
import Questionnaire from "@/components/sale/Questionnaire";
import GeneratedDocs from "@/components/sale/GeneratedDocs";
import AuthorityDocs from "@/components/sale/AuthorityDocs";
import EudrPanel from "@/components/sale/EudrPanel";
import AssistantPanel from "@/components/sale/AssistantPanel";
import SectionNav from "@/components/sale/SectionNav";
import { t, useLang } from "@/lib/i18n";
import { needsEudr, saleTotals } from "@/lib/sale/model";
import { createSale, useCurrentSale, useSaleBook } from "@/lib/sale/store";

export default function SellPage() {
  const lang = useLang();
  const book = useSaleBook();
  const sale = useCurrentSale();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-7xl px-5 pb-24 pt-6 sm:px-8">
      <Breadcrumb items={[{ label: t(lang, "nav_home"), href: "/" }, { label: t(lang, "nav_sell") }]} />

      <header className="mt-6">
        <h1 className="font-display text-[2rem] leading-[1.06] sm:text-[2.4rem]">{t(lang, "sell_title")}</h1>
        <p className="mt-3 text-[1rem] leading-relaxed muted" style={{ maxWidth: "62ch" }}>
          {t(lang, "sell_lede")}
        </p>
      </header>

      {book.sales.length === 0 || !sale ? (
        <div className="glass-card mt-8 flex flex-col items-center p-10 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <FilePlus2 size={22} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-[1.2rem] font-semibold">{t(lang, "sell_empty_title")}</h2>
          <p className="mt-2 text-[0.9rem] muted" style={{ maxWidth: "46ch" }}>
            {t(lang, "sell_empty_body")}
          </p>
          <button type="button" className="btn btn-primary mt-5 min-h-[48px]" onClick={() => createSale()}>
            {t(lang, "sell_empty_cta")}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <SaleBar sale={sale} lang={lang} />
          </div>

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-12">
              <Questionnaire sale={sale} lang={lang} />
              {needsEudr(sale) && <EudrPanel sale={sale} lang={lang} />}
              <GeneratedDocs sale={sale} lang={lang} />
              <AuthorityDocs sale={sale} lang={lang} />
            </div>

            <aside className="min-w-0 space-y-6 lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)] lg:max-h-[calc(100dvh-var(--nav-h)-3rem)] lg:self-start lg:overflow-y-auto">
              <SectionNav sale={sale} lang={lang} />
              <AssistantPanel sale={sale} lang={lang} />
              {sale.productId && (
                <PriceCard productId={sale.productId} quantityKg={saleTotals(sale).netKg || undefined} />
              )}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
