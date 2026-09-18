"use client";

/**
 * Marketing landing page, the actual front door. Every number here is real
 * (pulled from the live catalog/markets/i18n data, not invented), and there is
 * no fabricated social proof (testimonials, client logos), the honesty section
 * carries the trust signal instead, matching the product's own "never invent"
 * rule.
 *
 * TYPE SCALE, set here and echoed by the rest of the app. The jumps are large
 * on purpose; there is deliberately nothing between `section` and `lede`:
 *   display   clamp(2.55rem, 6.2vw, 4.25rem)   .font-display, ONE per page (the hero)
 *   section   clamp(1.85rem, 3.4vw, 2.5rem)    .font-display, ONE per section
 *   lede      1.0625rem / 1.6, muted, capped ~60ch
 *   body      0.95rem
 *   small     0.85rem
 *   overline  0.7rem, 0.16em tracking, uppercase (Latin only, see overline())
 *
 * COMPOSITION RULES this page sets: one dominant element per viewport; a single
 * 12-column axis with asymmetric splits (7/5, 5/7) rather than centred stacks;
 * hairlines carry the structure so almost nothing needs a card; the accent
 * colour appears only on the primary action, the step numerals and two rules.
 * The lone glass surface here is the hero graphic, which is the only thing on
 * the page genuinely elevated above the paper.
 *
 * Every route-changing control is a <PendingLink>: the front door is the one
 * place a first-time visitor has no patience for an unacknowledged tap, and
 * these targets (/sell, /documents, /signup) each pull a sizeable bundle.
 */
import type { CSSProperties } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { t, useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/AuthProvider";
import { PRODUCTS, MARKETS } from "@/lib/compliance/catalog";
import { LANGS } from "@/lib/i18n/strings";
import Reveal from "@/components/motion/Reveal";
import Counter from "@/components/motion/Counter";
import ScrollReveal from "@/components/motion/ScrollReveal";
import Magnetic from "@/components/motion/Magnetic";
import PlotScan from "@/components/motion/PlotScan";
import PendingLink from "@/components/motion/PendingLink";
import { staggerContainer, staggerItem } from "@/lib/motion/variants";

const WIZARD_STEPS = ["q_product", "q_origin", "q_market", "q_details"] as const;

const SECONDARY_FEATURES = [
  ["landing_feature_eudr_title", "landing_feature_eudr_body"],
  ["landing_feature_shipping_title", "landing_feature_shipping_body"],
  ["landing_feature_lang_title", "landing_feature_lang_body"],
] as const;

const HAIRLINE: CSSProperties = { borderColor: "var(--glass-hairline)" };

/**
 * Sinhala and Tamil are unicameral and their conjuncts come apart under wide
 * tracking, so the small-caps overline treatment is applied only where it is
 * legible. Same reason the display leading opens up off English: Fraunces is
 * Latin-only, so those scripts fall back to a system serif whose ascenders and
 * descenders will not survive a 1.0 line-height.
 */
function overline(en: boolean, color = "var(--fg-faint)"): CSSProperties {
  return en
    ? { textTransform: "uppercase", letterSpacing: "0.16em", color }
    : { letterSpacing: "0.01em", color };
}

export default function Home() {
  const lang = useLang();
  const en = lang === "en";
  const reduce = useReducedMotion();
  const { configured, user } = useAuth();

  // Account-first: a signed-out visitor is prompted to create an account; a
  // signed-in one picks up where they left off. When auth isn't configured the
  // app stays open, so fall back to the sell flow.
  const authed = configured && !!user;
  const primaryHref = !configured ? "/sell" : authed ? "/documents" : "/signup";
  const primaryLabel = !configured
    ? t(lang, "landing_cta_primary")
    : authed
      ? t(lang, "cta_continue")
      : t(lang, "cta_create_account");

  const stats = [
    { value: PRODUCTS.length, label: t(lang, "landing_stat_products") },
    { value: MARKETS.length, label: t(lang, "landing_stat_markets") },
    { value: 3, label: t(lang, "landing_stat_countries") },
    { value: LANGS.length, label: t(lang, "landing_stat_languages") },
  ];

  const sectionHeading: CSSProperties = {
    fontSize: "clamp(1.85rem, 3.4vw, 2.5rem)",
    lineHeight: en ? 1.04 : 1.24,
    letterSpacing: "-0.025em",
  };

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="mx-auto max-w-6xl px-5 pt-12 sm:px-8 sm:pt-20 lg:pt-24">
        <div className="grid gap-y-16 lg:grid-cols-12 lg:items-center lg:gap-x-12">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="flex items-center gap-3 text-[0.7rem] font-semibold" style={overline(en)}>
                <span aria-hidden="true" className="h-px w-7 shrink-0" style={{ background: "var(--accent)" }} />
                {t(lang, "landing_eyebrow")}
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <h1
                className="font-display mt-6 text-balance"
                style={{
                  fontSize: "clamp(2.55rem, 6.2vw, 4.25rem)",
                  lineHeight: en ? 1.0 : 1.22,
                  letterSpacing: "-0.032em",
                }}
              >
                {t(lang, "landing_hero_title")}
              </h1>
            </Reveal>

            {/*
              What this is, in one sentence, in the reader's own language, with
              the accent rule marking it as the definition rather than one more
              paragraph. Sinhala follows underneath for anyone who has landed on
              the English default but reads Sinhala faster — it used to lead,
              which made the English page look like a mistranslation of itself.
            */}
            <Reveal delay={0.09}>
              <div className="mt-9 border-l-2 pl-5 sm:pl-6" style={{ borderColor: "var(--accent)" }}>
                <p
                  className="max-w-[46ch] font-medium"
                  lang={lang}
                  style={{ fontSize: "clamp(1.15rem, 2vw, 1.4rem)", lineHeight: 1.52 }}
                >
                  {t(lang, "landing_what_is")}
                </p>
                {lang !== "si" && (
                  <p className="mt-2.5 max-w-[46ch] text-[0.9rem] leading-relaxed muted" lang="si">
                    {t("si", "landing_what_is")}
                  </p>
                )}
              </div>
            </Reveal>

            <Reveal delay={0.14}>
              <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Magnetic>
                  <PendingLink href={primaryHref} className="btn btn-primary btn-lg">
                    <span className="inline-flex items-center gap-2">
                      {primaryLabel}
                      <ArrowRight size={17} aria-hidden="true" />
                    </span>
                  </PendingLink>
                </Magnetic>
                {/* Demoted from a second button to a text link, so the hero has
                    exactly one primary action. In-page scroll, not a
                    navigation: no spinner, the press state is the whole
                    acknowledgement it needs. */}
                <a
                  href="#how"
                  className="inline-flex min-h-[44px] items-center text-[0.95rem] font-medium underline decoration-[color:var(--glass-hairline)] decoration-1 underline-offset-[6px] transition-transform duration-150 hover:decoration-[color:var(--accent)] active:scale-[0.97]"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {t(lang, "landing_cta_secondary")}
                </a>
              </div>
            </Reveal>
          </div>

          {/* The one genuinely elevated surface on this page: a satellite
              plot-scan (self-contained SVG, a stylised illustration, never a
              claim about a real plot). */}
          <Reveal variant="fade" delay={0.2} className="lg:col-span-5">
            <PlotScan />
          </Reveal>
        </div>

        {/* Stats demoted from a four-up glass box to a quiet inline row under a
            single rule. Numbers are read off the live catalog, never invented. */}
        <Reveal delay={0.1}>
          <ul className="mt-16 flex flex-wrap gap-x-10 gap-y-3 border-t pt-6 sm:mt-20 sm:gap-x-14" style={HAIRLINE}>
            {stats.map((s) => (
              <li key={s.label} className="flex items-baseline gap-2">
                <span className="text-[1.3rem] font-semibold tabular-nums" style={{ letterSpacing: "-0.02em" }}>
                  <Counter to={s.value} />
                </span>
                <span className="text-[0.85rem] muted">{s.label}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* ---------- how it works ---------- */}
      {/* scroll-mt clears the sticky nav, so the heading is not parked under it. */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32">
        <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <Reveal>
              <h2 className="font-display max-w-[16ch] text-balance" style={sectionHeading}>
                {t(lang, "landing_how_title")}
              </h2>
              <p className="mt-6 max-w-[52ch] text-[1.0625rem] leading-relaxed muted">
                {t(lang, "landing_hero_sub")}
              </p>
              <p className="mt-4 max-w-[52ch] text-[0.9rem] leading-relaxed faint">
                {t(lang, "landing_how_sub")}
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            {/* A numbered list, not four identical cards: these steps are
                ordered, and a uniform grid actively hides the order. */}
            <motion.ol
              initial={reduce ? undefined : "hidden"}
              whileInView={reduce ? undefined : "show"}
              viewport={{ once: true, margin: "-60px" }}
              variants={reduce ? undefined : staggerContainer(0.06)}
            >
              {WIZARD_STEPS.map((key, i) => (
                <motion.li
                  key={key}
                  variants={reduce ? undefined : staggerItem}
                  className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-5 border-t py-5 sm:py-6"
                  style={HAIRLINE}
                >
                  <span
                    className="text-[0.8rem] font-semibold tabular-nums"
                    style={{ color: "var(--accent)", letterSpacing: "0.08em" }}
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium" style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.2rem)", lineHeight: 1.4 }}>
                    {t(lang, key)}
                  </span>
                </motion.li>
              ))}
            </motion.ol>

            {/* The payoff keeps the list's rhythm rather than becoming another
                card: same rule, same gutter, an arrow where a numeral would be. */}
            <Reveal delay={0.05}>
              <div className="grid grid-cols-[2.5rem_1fr] gap-x-5 border-t py-6" style={HAIRLINE}>
                <ArrowRight size={19} className="mt-1" style={{ color: "var(--accent)" }} aria-hidden="true" />
                <div>
                  <p className="text-[1.05rem] font-semibold">{t(lang, "landing_how_result_title")}</p>
                  <p className="mt-2.5 max-w-[58ch] text-[0.95rem] leading-relaxed muted">
                    {t(lang, "landing_how_result_body")}
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- manifesto (scroll-driven word reveal) ---------- */}
      {/* No aria-label: the section's whole content is one sentence, so naming
          the region would just make a screen reader read it twice. */}
      <section>
        <ScrollReveal text={t(lang, "landing_manifesto")} accentWords={["four", "simple", "questions", "documents"]} />
      </section>

      {/* ---------- features ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal>
          <p className="text-[0.7rem] font-semibold" style={overline(en)}>
            {t(lang, "landing_features_eyebrow")}
          </p>
          <h2 className="font-display mt-5 max-w-[19ch] text-balance" style={sectionHeading}>
            {t(lang, "landing_features_title")}
          </h2>
        </Reveal>

        {/* One feature leads at roughly double the weight of the other three,
            which sit as a plain three-up split by vertical hairlines. No cards,
            no icon tiles: the type does the ranking. */}
        <Reveal delay={0.06}>
          <div className="mt-14 grid gap-x-12 gap-y-4 border-t pt-8 sm:pt-10 lg:grid-cols-12" style={HAIRLINE}>
            <h3
              className="lg:col-span-5"
              style={{
                fontSize: "clamp(1.35rem, 2.2vw, 1.7rem)",
                lineHeight: en ? 1.15 : 1.35,
                letterSpacing: "-0.02em",
              }}
            >
              {t(lang, "landing_feature_docs_title")}
            </h3>
            <p className="max-w-[58ch] text-[1.0625rem] leading-relaxed muted lg:col-span-6 lg:col-start-7">
              {t(lang, "landing_feature_docs_body")}
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <dl className="mt-12 grid border-t sm:grid-cols-3" style={HAIRLINE}>
            {SECONDARY_FEATURES.map(([titleKey, bodyKey], i) => (
              <div
                key={titleKey}
                className={[
                  "py-7 sm:py-8 sm:pr-8",
                  i > 0 ? "border-t sm:border-t-0 sm:border-l sm:pl-8" : "",
                ].join(" ")}
                style={HAIRLINE}
              >
                <dt className="text-[1rem] font-semibold leading-snug">{t(lang, titleKey)}</dt>
                <dd className="mt-2.5 max-w-[42ch] text-[0.9rem] leading-relaxed muted">{t(lang, bodyKey)}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      {/* ---------- honesty ---------- */}
      {/* A full-bleed band rather than a card. It is the page's trust anchor, so
          it gets its own ground and the only use of the secondary accent. */}
      <section className="border-y" style={{ ...HAIRLINE, background: "var(--bg-1)" }}>
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-28">
          <div className="grid gap-y-8 lg:grid-cols-12 lg:gap-x-12">
            <Reveal className="lg:col-span-5">
              <p className="text-[0.7rem] font-semibold" style={overline(en, "var(--gold)")}>
                {t(lang, "landing_honesty_eyebrow")}
              </p>
              <h2 className="font-display mt-5 max-w-[14ch] text-balance" style={sectionHeading}>
                {t(lang, "landing_honesty_title")}
              </h2>
            </Reveal>
            <Reveal delay={0.06} className="lg:col-span-6 lg:col-start-7 lg:pt-2">
              <p className="max-w-[64ch] text-[1.0625rem] leading-relaxed muted">
                {t(lang, "landing_honesty_body")}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- also in plotproof ---------- */}
      <section className="mx-auto max-w-6xl px-5 pt-20 sm:px-8 sm:pt-24">
        <Reveal>
          <h2 className="text-[0.7rem] font-semibold" style={overline(en)}>
            {t(lang, "landing_also_title")}
          </h2>
        </Reveal>
        <ul className="mt-6">
        </ul>
      </section>

      {/* ---------- final cta ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal>
          <div className="grid gap-y-8 lg:grid-cols-12 lg:items-end lg:gap-x-12">
            <div className="lg:col-span-7">
              <h2 className="font-display max-w-[18ch] text-balance" style={sectionHeading}>
                {t(lang, "landing_final_cta_title")}
              </h2>
              <p className="mt-4 max-w-[48ch] text-[0.95rem] muted">{t(lang, "landing_final_cta_sub")}</p>
            </div>
            <div className="lg:col-span-5 lg:justify-self-end">
              <PendingLink href={primaryHref} className="btn btn-primary btn-lg">
                <span className="inline-flex items-center gap-2">
                  {primaryLabel}
                  <ArrowRight size={17} aria-hidden="true" />
                </span>
              </PendingLink>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

/**
 * A quiet full-width navigation row. The anchor stays `block` so the whole row
 * is the hit area even though PendingLink wraps its children in a shrink-to-fit
 * inline-flex span, which is also why the arrow sits inline after the title
 * rather than being pushed out to the far right.
 */
function SecondaryRow({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <li className="border-t" style={HAIRLINE}>
      <PendingLink
        href={href}
        className="group -mx-3 block rounded-[var(--radius-sm)] px-3 py-5 transition-colors duration-150 hover:bg-[var(--accent-soft)] active:bg-[var(--glass-hairline)]"
      >
        <span className="block">
          <span className="flex items-center gap-2 font-semibold">
            {title}
            <ArrowUpRight
              size={16}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              style={{ color: "var(--accent)" }}
            />
          </span>
          <span className="mt-1 block max-w-[62ch] text-[0.9rem] leading-relaxed muted">{body}</span>
        </span>
      </PendingLink>
    </li>
  );
}
