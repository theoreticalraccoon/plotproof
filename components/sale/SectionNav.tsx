"use client";

/** Where the officer is and what is left, in one column. */
import { CheckCircle2, Circle } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import {
  isSaleComplete,
  issuesBySection,
  needsEudr,
  saleIssues,
  saleRequirements,
  type SaleSection,
} from "@/lib/sale/model";
import type { Sale } from "@/lib/sale/types";

const FORM: SaleSection[] = ["exporter", "buyer", "product", "packing", "commercial", "shipment"];
const PRODUCED_HERE = new Set(["commercial_invoice", "packing_list", "hs_classification"]);

interface Item {
  href: string;
  label: string;
  /** True when this entry needs nothing further. */
  done: boolean;
  /** What to print on the right, if anything. */
  note?: string;
}

export default function SectionNav({ sale, lang }: { sale: Sale; lang: Lang }) {
  const by = issuesBySection(saleIssues(sale));
  const req = saleRequirements(sale);
  const authority = (req?.documents ?? []).filter((d) => !PRODUCED_HERE.has(d.documentTypeId));
  const obtained = authority.filter((d) => sale.authorityStatus[d.documentTypeId] === "ready").length;
  const complete = isSaleComplete(sale);

  const items: Item[] = [
    ...FORM.map((s) => ({
      href: `#sale-${s}`,
      label: t(lang, `sale_s_${s}`),
      done: by[s].length === 0,
      note: by[s].length ? t(lang, "sale_s_left", { n: by[s].length }) : undefined,
    })),
    ...(needsEudr(sale)
      ? [
          {
            href: "#eudr",
            label: t(lang, "sale_s_eudr"),
            done: by.eudr.length === 0,
            note: by.eudr.length ? t(lang, "sale_s_left", { n: by.eudr.length }) : undefined,
          },
        ]
      : []),
    {
      href: "#documents",
      label: t(lang, "sale_docs_title"),
      done: complete,
      note: t(lang, complete ? "sale_ready" : "sale_draft"),
    },
    // No product or buyer yet means no requirements are known, so this entry reports nothing
    // rather than a reassuring tick.
    {
      href: "#authority",
      label: t(lang, "sale_auth_title"),
      done: authority.length > 0 && obtained === authority.length,
      note: authority.length
        ? t(lang, "sale_auth_progress", { done: obtained, total: authority.length })
        : undefined,
    },
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
              <span className="flex min-w-0 items-center gap-2">
                {i.done ? (
                  <CheckCircle2 size={14} aria-hidden="true" style={{ color: "var(--accent)" }} />
                ) : (
                  <Circle size={12} aria-hidden="true" className="faint shrink-0" />
                )}
                <span className="truncate">{i.label}</span>
              </span>
              {i.note && <span className="shrink-0 text-[0.72rem] tabular-nums faint">{i.note}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
