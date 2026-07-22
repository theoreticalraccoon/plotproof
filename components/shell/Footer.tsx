"use client";

import Link from "next/link";
import { Leaf, ShieldCheck } from "lucide-react";
import { t, useLang } from "@/lib/i18n";

const PRODUCT_LINKS = [
  { href: "/sell", key: "nav_sell" },
  { href: "/documents", key: "nav_documents" },
  { href: "/intake", key: "nav_evidence" },
] as const;

const RESOURCE_LINKS = [
  { href: "/explore", key: "nav_explore" },
  { href: "/alerts", key: "nav_alerts" },
  { href: "/acoustic", key: "footer_acoustic" },
  { href: "/privacy", key: "footer_privacy" },
] as const;

export default function Footer() {
  const lang = useLang();
  return (
    <footer className="no-print mt-16 border-t" style={{ borderColor: "var(--glass-border-2)" }}>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr_1.4fr]">
          <div>
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              >
                <Leaf size={15} strokeWidth={2.25} />
              </span>
              PlotProof
            </div>
            <p className="mt-3 max-w-xs text-sm muted">{t(lang, "footer_tagline")}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide faint">{t(lang, "footer_product")}</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="muted hover:underline underline-offset-2">
                    {t(lang, l.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide faint">{t(lang, "footer_resources")}</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {RESOURCE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="muted hover:underline underline-offset-2">
                    {t(lang, l.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={16} style={{ color: "var(--accent)" }} />
              {t(lang, "footer_honesty_title")}
            </div>
            <p className="mt-2 text-xs muted">{t(lang, "footer_honesty_body")}</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col-reverse items-center gap-3 border-t pt-6 text-xs faint sm:flex-row sm:justify-between" style={{ borderColor: "var(--glass-border-2)" }}>
          <span>PlotProof · {t(lang, "footer_rights")}</span>
        </div>
      </div>
    </footer>
  );
}
