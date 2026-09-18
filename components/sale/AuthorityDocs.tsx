"use client";

/**
 * Documents only an authority can issue, for this consignment.
 *
 * These are never generated as look-alikes: a phytosanitary certificate the app
 * "made" would be a forgery. Instead each is explained — what it is, why this
 * consignment needs it, who issues it and how — with the authority named and
 * the source cited, and the officer ticks it off once obtained.
 *
 * The list comes from the sourced catalog via the requirement resolver, so it
 * changes with the product and the buyer's market: tea gains the Tea Board, an
 * EU rubber consignment gains EUDR, a US one gains FDA prior notice.
 */
import { ArrowDown, ChevronDown, ShieldCheck } from "lucide-react";
import PendingLink from "@/components/motion/PendingLink";
import { t, type Lang } from "@/lib/i18n";
import { CATALOG_VERIFIED_AT } from "@/lib/compliance/catalog";
import { saleRequirements } from "@/lib/sale/model";
import { updateSale } from "@/lib/sale/store";
import type { Sale } from "@/lib/sale/types";

/** Documents the app itself produces are shown elsewhere on the page. */
const PRODUCED_HERE = new Set(["commercial_invoice", "packing_list", "hs_classification"]);

export default function AuthorityDocs({ sale, lang }: { sale: Sale; lang: Lang }) {
  const req = saleRequirements(sale);

  if (!req) {
    return (
      <section aria-labelledby="auth-heading" id="authority">
        <h2 id="auth-heading" className="font-display text-[1.55rem] leading-tight">
          {t(lang, "sale_auth_title")}
        </h2>
        <p className="mt-2 text-[0.9rem] muted">{t(lang, "sale_auth_need_product")}</p>
      </section>
    );
  }

  const docs = req.documents.filter((d) => !PRODUCED_HERE.has(d.documentTypeId));
  const done = docs.filter((d) => sale.authorityStatus[d.documentTypeId] === "ready").length;

  const toggle = (id: string) =>
    updateSale(sale.id, (s) => ({
      ...s,
      authorityStatus: {
        ...s.authorityStatus,
        [id]: s.authorityStatus[id] === "ready" ? "not_started" : "ready",
      },
    }));

  return (
    <section aria-labelledby="auth-heading" id="authority">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="auth-heading" className="font-display text-[1.55rem] leading-tight">
            {t(lang, "sale_auth_title")}
          </h2>
          <p className="mt-1.5 text-[0.9rem] muted" style={{ maxWidth: "58ch" }}>
            {t(lang, "sale_auth_lede")}
          </p>
        </div>
        <p className="text-[0.85rem] font-medium tabular-nums" role="status">
          {t(lang, "sale_auth_progress", { done, total: docs.length })}
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {docs.map((d) => {
          const ready = sale.authorityStatus[d.documentTypeId] === "ready";
          const inApp = d.actionHref && d.actionHref.startsWith("/sell#");
          return (
            <li key={d.documentTypeId} className="glass-card p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={`auth-${d.documentTypeId}`}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
                  checked={ready}
                  onChange={() => toggle(d.documentTypeId)}
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={`auth-${d.documentTypeId}`} className="cursor-pointer">
                    <span
                      className="text-[0.98rem] font-semibold"
                      style={{ textDecoration: ready ? "line-through" : undefined, opacity: ready ? 0.7 : 1 }}
                    >
                      {d.name}
                    </span>
                  </label>
                  <p className="mt-1 text-[0.85rem] muted">{d.what}</p>

                  <details className="group mt-2">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[0.82rem] font-medium" style={{ color: "var(--accent)" }}>
                      {t(lang, "sale_auth_how")}
                      <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-2 space-y-2 border-l-2 pl-3.5 text-[0.84rem]" style={{ borderColor: "var(--glass-hairline)" }}>
                      <p>
                        <span className="font-semibold">{t(lang, "sale_auth_why")}</span> {d.why}
                      </p>
                      <p>
                        <span className="font-semibold">{t(lang, "sale_auth_obtain")}</span> {d.howToObtain}
                      </p>
                      <p className="flex items-start gap-1.5 text-[0.78rem] faint">
                        <ShieldCheck size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                        {d.source}
                      </p>
                    </div>
                  </details>

                  {inApp && (
                    <PendingLink
                      href={d.actionHref!}
                      className="mt-2 inline-flex items-center gap-1 text-[0.82rem] font-medium underline underline-offset-4"
                    >
                      <ArrowDown size={13} aria-hidden="true" /> {t(lang, "sale_auth_go_eudr")}
                    </PendingLink>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[0.75rem] faint">
        {t(lang, "sale_auth_verified", { date: CATALOG_VERIFIED_AT })}
      </p>
    </section>
  );
}
