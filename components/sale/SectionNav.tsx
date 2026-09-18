"use client";

/**
 * Where the officer is and what is left, in one column.
 *
 * Every entry is an anchor to a section on this page, with its own count of
 * what is missing — so the answer to "what do I still need for this
 * consignment?" is always on screen rather than found by scrolling.
 */
import { CheckCircle2, Circle } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import { issuesBySection, needsEudr, saleIssues, saleRequirements, type SaleSection } from "@/lib/sale/model";
import type { Sale } from "@/lib/sale/types";

const FORM: SaleSection[] = ["exporter", "buyer", "product", "packing", "commercial", "shipment"];
const PRODUCED_HERE = new Set(["commercial_invoice", "packing_list", "hs_classification"]);

export default function SectionNav({ sale, lang }: { sale: Sale; lang: Lang }) {
  const by = issuesBySection(saleIssues(sale));
  const req = saleRequirements(sale);
  const authority = (req?.documents ?? []).filter((d) => !PRODUCED_HERE.has(d.documentTypeId));
  const authorityLeft = authority.filter((d) => sale.authorityStatus[d.documentTypeId] !== "ready").length;
  const formLeft = FORM.reduce((n, s) => n + by[s].length, 0);

  const items: { href: string; label: string; left: number }[] = [
    ...FORM.map((s) => ({ href: `#sale-${s}`, label: t(lang, `sale_s_${s}`), left: by[s].length })),
    ...(needsEudr(sale) ? [{ href: "#eudr", label: t(lang, "sale_s_eudr"), left: by.eudr.length }] : []),
    { href: "#documents", label: t(lang, "sale_docs_title"), left: formLeft },
    { href: "#authority", label: t(lang, "sale_auth_title"), left: authorityLeft },
  ];

  return (
    <nav aria-label={t(lang, "sale_nav_label")} className="glass-card hidden p-4 lg:block">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] faint">{t(lang, "sale_nav_label")}</p>
      <ul className="mt-3 space-y-0.5">
        {items.map((i) => (
          <li key={i.href}>
            <a
              href={i.href}
              className="flex min-h-[36px] items-center justify-between gap-3 rounded-lg px-2 text-[0.86rem] hover:bg-[var(--bg-1)]"
            >
              <span className="flex items-center gap-2">
                {i.left === 0 ? (
                  <CheckCircle2 size={14} aria-hidden="true" style={{ color: "var(--accent)" }} />
                ) : (
                  <Circle size={12} aria-hidden="true" className="faint" />
                )}
                {i.label}
              </span>
              {i.left > 0 && (
                <span className="text-[0.72rem] tabular-nums faint">{t(lang, "sale_s_left", { n: i.left })}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
