"use client";

/**
 * Site footer. Two link columns between the brand mark and the honesty note, so
 * the "what we won't do" promise sits at the end of every page rather than
 * being something you have to go looking for.
 *
 * It is the last thing on the page and should read like it: everything here is
 * one step quieter than the page above it (small type, muted throughout, a
 * single hairline instead of borders and boxes). The honesty note used to sit
 * in a glass card, which made the quietest region of the page hold the loudest
 * surface; it is now plain text under an accent rule.
 *
 * Links are PendingLink like the rest of navigation: a footer link is often the
 * slowest jump in the app, which is exactly
 * where an unacknowledged tap gets repeated.
 */
import { Leaf } from "lucide-react";
import PendingLink from "@/components/motion/PendingLink";
import { t, useLang } from "@/lib/i18n";

const PRODUCT_LINKS = [
  { href: "/sell", key: "nav_sell" },
  { href: "/documents", key: "nav_documents" },
  { href: "/intake", key: "nav_evidence" },
] as const;

const RESOURCE_LINKS = [
  { href: "/whats-real", key: "footer_whats_real" },
  { href: "/privacy", key: "footer_privacy" },
] as const;

const HAIRLINE = { borderColor: "var(--glass-hairline)" };

function LinkColumn({ heading, links }: { heading: string; links: readonly { href: string; key: string }[] }) {
  const lang = useLang();
  const en = lang === "en";
  return (
    <div>
      <h3
        className="text-[0.66rem] font-semibold"
        style={
          en
            ? { textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--fg-faint)" }
            : { letterSpacing: "0.01em", color: "var(--fg-faint)" }
        }
      >
        {heading}
      </h3>
      {/* -mx-2 pulls the padded hit areas back to the column's optical edge, so
          the links stay flush with the heading while still being 40px tall. */}
      <ul className="mt-3 -mx-2 flex flex-col text-[0.85rem]">
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
  const en = lang === "en";
  return (
    <footer className="no-print mt-20 border-t" style={HAIRLINE}>
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
        {/* Brand and the honesty note are the wide pair; the two link columns
            are the narrow pair. Below lg they stack two-up rather than
            collapsing into one long ribbon of links. */}
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.85fr_0.85fr_1.5fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-[0.95rem] font-semibold" style={{ letterSpacing: "-0.02em" }}>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              >
                <Leaf size={13} strokeWidth={2.25} aria-hidden="true" />
              </span>
              PlotProof
            </div>
            <p className="mt-3.5 max-w-[34ch] text-[0.85rem] leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              {t(lang, "footer_tagline")}
            </p>
          </div>

          <LinkColumn heading={t(lang, "footer_product")} links={PRODUCT_LINKS} />
          <LinkColumn heading={t(lang, "footer_resources")} links={RESOURCE_LINKS} />

          <div className="border-l-2 pl-4 sm:col-span-2 lg:col-span-1" style={{ borderColor: "var(--accent-ring)" }}>
            <h3
              className="text-[0.66rem] font-semibold"
              style={
                en
                  ? { textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--fg-faint)" }
                  : { letterSpacing: "0.01em", color: "var(--fg-faint)" }
              }
            >
              {t(lang, "footer_honesty_title")}
            </h3>
            <p className="mt-3 max-w-[46ch] text-[0.8rem] leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              {t(lang, "footer_honesty_body")}
            </p>
          </div>
        </div>

        <div className="mt-14 border-t pt-6 text-[0.75rem] faint" style={HAIRLINE}>
          <span>PlotProof · {t(lang, "footer_rights")}</span>
        </div>
      </div>
    </footer>
  );
}
