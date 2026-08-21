"use client";

/**
 * Marketing landing page, the actual front door. Previously `/` was just the
 * sell-CTA card with a links list; this is a real hero → how-it-works →
 * features → honesty → CTA page. Every number here is real (pulled from the
 * live catalog/markets/i18n data, not invented), and there is no fabricated
 * social proof (testimonials, client logos), the honesty section carries the
 * trust signal instead, matching the product's own "never invent" rule.
 *
 * Every route-changing control is a <PendingLink>: the front door is the one
 * place a first-time visitor has no patience for an unacknowledged tap, and
 * these targets (/sell, /documents, /login) each pull a sizeable bundle.
 */
import {
  ArrowRight,
  FileText,
  Satellite,
  Ship,
  Languages,
  ShieldCheck,
  MapPin,
  AudioLines,
} from "lucide-react";
import { t, useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/AuthProvider";
import { PRODUCTS, MARKETS } from "@/lib/compliance/catalog";
import { LANGS } from "@/lib/i18n/strings";
import Reveal from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import Counter from "@/components/motion/Counter";
import ScrollReveal from "@/components/motion/ScrollReveal";
import Magnetic from "@/components/motion/Magnetic";
import PlotScan from "@/components/motion/PlotScan";
import PendingLink from "@/components/motion/PendingLink";
import { hoverLift } from "@/lib/motion/variants";
import { motion } from "framer-motion";

const WIZARD_STEPS = ["q_product", "q_origin", "q_market", "q_details"] as const;

export default function Home() {
  const lang = useLang();
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

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-10 sm:px-8 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
          <div>
            <Reveal>
              <span className="eyebrow">
                <Satellite size={13} aria-hidden="true" /> {t(lang, "landing_eyebrow")}
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="font-display mt-5 text-[2.45rem] leading-[1.06] sm:text-5xl lg:text-[3.4rem] lg:leading-[1.04]">
                {t(lang, "landing_hero_title")}
              </h1>
            </Reveal>
            {/*
              What this is, in one sentence, Sinhala first, always. The accent
              rule marks it as the definition rather than as one more paragraph:
              a reader who takes in nothing else on this page should take in
              this line, in the language most of our users read fastest.
            */}
            <Reveal delay={0.08}>
              <div
                className="mt-7 max-w-xl border-l-2 pl-4 sm:pl-5"
                style={{ borderColor: "var(--accent-ring)" }}
              >
                <p className="text-lg font-medium leading-[1.5] sm:text-xl" lang="si">
                  {t("si", "landing_what_is")}
                </p>
                {lang !== "si" && (
                  <p className="mt-2 text-sm muted" lang={lang}>
                    {t(lang, "landing_what_is")}
                  </p>
                )}
              </div>
            </Reveal>
            <Reveal delay={0.11}>
              <p className="mt-6 max-w-xl text-base muted sm:text-lg">
                {t(lang, "landing_hero_sub")}
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <PendingLink href={primaryHref} className="btn btn-primary btn-lg">
                    <span className="inline-flex items-center gap-2">
                      {primaryLabel}
                      <ArrowRight size={17} aria-hidden="true" />
                    </span>
                  </PendingLink>
                </Magnetic>
                {/* In-page scroll, not a navigation: no spinner, the press
                    scale on .btn is the whole acknowledgement it needs. */}
                <a href="#how" className="btn btn-ghost btn-lg">
                  {t(lang, "landing_cta_secondary")}
                </a>
              </div>
            </Reveal>
          </div>

          {/* cinematic hero graphic: satellite plot-scan (self-contained SVG) */}
          <Reveal variant="fade" delay={0.2}>
            <PlotScan />
          </Reveal>
        </div>

        {/* stats strip, real numbers only, read off the live catalog */}
        <Reveal delay={0.1}>
          <dl className="glass mt-16 grid grid-cols-2 sm:mt-20 sm:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={[
                  "px-6 py-6 sm:px-7 sm:py-7",
                  i % 2 === 1 ? "border-l" : "",
                  i > 0 ? "sm:border-l" : "",
                  i >= 2 ? "border-t sm:border-t-0" : "",
                ].join(" ")}
                style={{ borderColor: "var(--glass-hairline)" }}
              >
                <dd
                  className="text-[2rem] font-semibold tracking-tight tabular-nums sm:text-[2.6rem]"
                  style={{ color: "var(--accent)" }}
                >
                  <Counter to={s.value} />
                </dd>
                <dt className="mt-1.5 text-[0.78rem] leading-snug muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      {/* ---------- how it works ---------- */}
      {/* scroll-mt clears the sticky nav, so the heading is not parked under it. */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <h2 className="font-display max-w-lg text-2xl sm:text-[2rem]">
            {t(lang, "landing_how_title")}
          </h2>
          <p className="mt-3 max-w-xl muted">{t(lang, "landing_how_sub")}</p>
        </Reveal>

        <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WIZARD_STEPS.map((key, i) => (
            <StaggerItem key={key} className="h-full">
              <div className="glass-card flex h-full flex-col p-5 sm:p-6">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    boxShadow: "inset 0 0 0 1px var(--accent-ring)",
                  }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <p className="mt-4 font-semibold leading-snug">{t(lang, key)}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <Reveal delay={0.1}>
          <div className="glass-card glass-glow mt-5 flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="font-semibold">{t(lang, "landing_how_result_title")}</p>
              <p className="mt-1.5 max-w-lg text-sm muted">{t(lang, "landing_how_result_body")}</p>
            </div>
            <PendingLink href={primaryHref} className="btn btn-primary shrink-0">
              <span className="inline-flex items-center gap-2">
                {primaryLabel}
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </PendingLink>
          </div>
        </Reveal>
      </section>

      {/* ---------- manifesto (scroll-driven word reveal) ---------- */}
      <section aria-label="What PlotProof does">
        <ScrollReveal
          text={t(lang, "landing_manifesto")}
          accentWords={["four", "simple", "questions", "documents"]}
        />
      </section>

      {/* ---------- features ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <span className="eyebrow">{t(lang, "landing_features_eyebrow")}</span>
          <h2 className="font-display mt-5 max-w-2xl text-2xl sm:text-[2rem]">
            {t(lang, "landing_features_title")}
          </h2>
        </Reveal>

        <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
          <FeatureCard icon={<FileText size={19} />} title={t(lang, "landing_feature_docs_title")} body={t(lang, "landing_feature_docs_body")} />
          <FeatureCard icon={<Satellite size={19} />} title={t(lang, "landing_feature_eudr_title")} body={t(lang, "landing_feature_eudr_body")} />
          <FeatureCard icon={<Ship size={19} />} title={t(lang, "landing_feature_shipping_title")} body={t(lang, "landing_feature_shipping_body")} />
          <FeatureCard icon={<Languages size={19} />} title={t(lang, "landing_feature_lang_title")} body={t(lang, "landing_feature_lang_body")} />
        </StaggerGroup>
      </section>

      {/* ---------- honesty ---------- */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 sm:pb-28">
        <Reveal>
          <div
            className="glass-card glass-glow overflow-hidden p-8 sm:p-12"
            style={{ borderColor: "var(--gold-ring)" }}
          >
            <span
              className="eyebrow"
              style={{ background: "var(--gold-soft)", color: "var(--gold)", borderColor: "var(--gold-ring)" }}
            >
              <ShieldCheck size={13} aria-hidden="true" /> {t(lang, "landing_honesty_eyebrow")}
            </span>
            <h2 className="font-display mt-5 max-w-2xl text-2xl sm:text-[2rem]">
              {t(lang, "landing_honesty_title")}
            </h2>
            <p className="mt-4 max-w-2xl text-base muted">{t(lang, "landing_honesty_body")}</p>
          </div>
        </Reveal>
      </section>

      {/* ---------- also in plotproof ---------- */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <hr className="hairline" />
          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide faint">
            {t(lang, "landing_also_title")}
          </h2>
        </Reveal>
        <StaggerGroup className="mt-4 grid gap-4 sm:grid-cols-2">
          <StaggerItem className="h-full">
            <SecondaryLink
              href="/explore"
              icon={<MapPin size={17} />}
              title={t(lang, "nav_explore")}
              body={t(lang, "landing_explore_desc")}
            />
          </StaggerItem>
          <StaggerItem className="h-full">
            <SecondaryLink
              href="/acoustic"
              icon={<AudioLines size={17} />}
              title={t(lang, "footer_acoustic")}
              body={t(lang, "landing_acoustic_desc")}
            />
          </StaggerItem>
        </StaggerGroup>
      </section>

      {/* ---------- final cta ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <div className="glass-card glass-glow flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12">
            <div>
              <h2 className="font-display max-w-lg text-2xl sm:text-[2rem]">
                {t(lang, "landing_final_cta_title")}
              </h2>
              <p className="mt-3 muted">{t(lang, "landing_final_cta_sub")}</p>
            </div>
            <Magnetic>
              <PendingLink href={primaryHref} className="btn btn-primary btn-lg">
                <span className="inline-flex items-center gap-2">
                  {primaryLabel}
                  <ArrowRight size={17} aria-hidden="true" />
                </span>
              </PendingLink>
            </Magnetic>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <motion.div {...hoverLift} className="glass-card h-full p-5 sm:p-6">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <p className="mt-4 font-semibold leading-snug">{title}</p>
      <p className="mt-2 text-sm leading-relaxed muted">{body}</p>
    </motion.div>
  );
}

/**
 * A whole-card navigation target. The anchor is `block` rather than `flex` so
 * PendingLink's inner wrapper (and with it the reserved spinner slot) sits on
 * the card's own baseline instead of competing with the icon/text row for
 * alignment.
 */
function SecondaryLink({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <motion.div {...hoverLift} className="h-full">
      <PendingLink href={href} className="glass block h-full p-5">
        <span className="flex flex-1 items-start gap-3 text-left">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            aria-hidden="true"
          >
            {icon}
          </span>
          <span className="block">
            <span className="block font-semibold">{title}</span>
            <span className="mt-0.5 block text-sm muted">{body}</span>
          </span>
        </span>
      </PendingLink>
    </motion.div>
  );
}
