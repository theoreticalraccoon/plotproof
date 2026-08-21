"use client";

/**
 * Site footer. Two link columns between the brand mark and the honesty card, so
 * the "what we won't do" promise sits at the end of every page rather than
 * being something you have to go looking for.
 *
 * Links are PendingLink like the rest of navigation: a footer link is often the
 * slowest jump in the app (/explore pulls the map bundle), which is exactly
 * where an unacknowledged tap gets repeated.
 */
import { Leaf, ShieldCheck } from "lucide-react";
import PendingLink from "@/components/motion/PendingLink";
import { t, useLang } from "@/lib/i18n";

const PRODUCT_LINKS = [
  { href: "/sell", key: "nav_sell" },
  { href: "/documents", key: "nav_documents" },
  { href: "/intake", key: "nav_evidence" },
] as const;

const RESOURCE_LINKS = [
  { href: "/explore", key: "nav_explore" },
  { href: "/acoustic", key: "footer_acoustic" },
  { href: "/whats-real", key: "footer_whats_real" },
  { href: "/privacy", key: "footer_privacy" },
] as const;

function LinkColumn({ heading, links }: { heading: string; links: readonly { href: string; key: string }[] }) {
  const lang = useLang();
  return (
    <div>
      <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--fg-faint)" }}>
        {heading}
      </h3>
      {/* -mx-2 pulls the padded hit areas back to the column's optical edge, so
          the links stay flush with the heading while still being 40px tall. */}
      <ul className="mt-3.5 -mx-2 flex flex-col text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <PendingLink
              href={l.href}
              className="inline-flex min-h-[40px] items-center rounded-lg px-2 transition-colors duration-150 hover:text-[var(--fg)]"
              style={{ color: "var(--fg-muted)" }}
            >
              {t(lang, l.key)}
            </PendingLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const lang = useLang();
  return (
    <footer className="no-print mt-16 border-t" style={{ borderColor: "var(--glass-border-2)" }}>
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        {/* Brand and the honesty card are the wide pair; the two link columns
            are the narrow pair. Below lg they stack two-up rather than
            collapsing into one long ribbon of links. */}
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.9fr_0.9fr_1.35fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              >
                <Leaf size={15} strokeWidth={2.25} />
              </span>
              PlotProof
            </div>
            <p className="mt-3.5 max-w-xs text-sm leading-relaxed muted">{t(lang, "footer_tagline")}</p>
          </div>

          <LinkColumn heading={t(lang, "footer_product")} links={PRODUCT_LINKS} />
          <LinkColumn heading={t(lang, "footer_resources")} links={RESOURCE_LINKS} />

          <div className="glass rounded-2xl p-5 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <ShieldCheck size={16} aria-hidden="true" style={{ color: "var(--accent)" }} />
              {t(lang, "footer_honesty_title")}
            </div>
            <p className="mt-2.5 text-xs leading-relaxed muted">{t(lang, "footer_honesty_body")}</p>
          </div>
        </div>

        <div
          className="mt-14 flex flex-col-reverse items-center gap-3 border-t pt-6 text-xs faint sm:flex-row sm:justify-between"
          style={{ borderColor: "var(--glass-border-2)" }}
        >
          <span>PlotProof · {t(lang, "footer_rights")}</span>
        </div>
      </div>
    </footer>
  );
}
