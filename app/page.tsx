"use client";

/**
 * Marketing landing page, the actual front door. Previously `/` was just the
 * sell-CTA card with a links list; this is a real hero → how-it-works →
 * features → honesty → CTA page. Every number here is real (pulled from the
 * live catalog/markets/i18n data, not invented), and there is no fabricated
 * social proof (testimonials, client logos), the honesty section carries the
 * trust signal instead, matching the product's own "never invent" rule.
 */
import Link from "next/link";
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
  const primaryHref = !configured ? "/sell" : authed ? "/documents" : "/login?mode=signup";
  const primaryLabel = !configured
    ? t(lang, "landing_cta_primary")
    : authed
      ? t(lang, "cta_continue")
      : t(lang, "cta_create_account");

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-8 sm:px-8 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Reveal>
              <span className="eyebrow">
                <Satellite size={13} /> {t(lang, "landing_eyebrow")}
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="font-display mt-5 text-4xl sm:text-5xl lg:text-[3.4rem] lg:leading-[1.04]">
                {t(lang, "landing_hero_title")}
              </h1>
            </Reveal>
            {/* What this is, in one sentence — Sinhala first, always. */}
            <Reveal delay={0.08}>
              <p className="mt-4 max-w-xl text-base font-medium sm:text-lg" lang="si">
                {t("si", "landing_what_is")}
              </p>
              {lang !== "si" && (
                <p className="mt-1.5 max-w-xl text-sm muted">{t(lang, "landing_what_is")}</p>
              )}
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-xl text-base muted sm:text-lg">{t(lang, "landing_hero_sub")}</p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <Link href={primaryHref} className="btn btn-primary btn-lg">
                    {primaryLabel}
                    <ArrowRight size={17} />
                  </Link>
                </Magnetic>
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

        {/* stats strip, real numbers only */}
        <Reveal delay={0.1}>
          <div className="glass mt-14 grid grid-cols-2 gap-6 p-6 sm:grid-cols-4 sm:p-8">
            <Stat value={PRODUCTS.length} label={t(lang, "landing_stat_products")} />
            <Stat value={MARKETS.length} label={t(lang, "landing_stat_markets")} />
            <Stat value={3} label={t(lang, "landing_stat_countries")} />
            <Stat value={LANGS.length} label={t(lang, "landing_stat_languages")} />
          </div>
        </Reveal>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <Reveal>
          <h2 className="font-display text-2xl sm:text-[2rem]">{t(lang, "landing_how_title")}</h2>
          <p className="mt-2 max-w-xl muted">{t(lang, "landing_how_sub")}</p>
        </Reveal>

        <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WIZARD_STEPS.map((key, i) => (
            <StaggerItem key={key}>
              <div className="glass-card h-full p-5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {i + 1}
                </span>
                <p className="mt-3.5 font-semibold">{t(lang, key)}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <Reveal delay={0.1}>
          <div className="glass-card glass-glow mt-6 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{t(lang, "landing_how_result_title")}</p>
              <p className="mt-1 max-w-lg text-sm muted">{t(lang, "landing_how_result_body")}</p>
            </div>
            <Link href={primaryHref} className="btn btn-primary shrink-0">
              {primaryLabel} <ArrowRight size={16} />
            </Link>
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
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <Reveal>
          <span className="eyebrow">{t(lang, "landing_features_eyebrow")}</span>
          <h2 className="font-display mt-4 text-2xl sm:text-[2rem]">{t(lang, "landing_features_title")}</h2>
        </Reveal>

        <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
          <FeatureCard icon={<FileText size={19} />} title={t(lang, "landing_feature_docs_title")} body={t(lang, "landing_feature_docs_body")} />
          <FeatureCard icon={<Satellite size={19} />} title={t(lang, "landing_feature_eudr_title")} body={t(lang, "landing_feature_eudr_body")} />
          <FeatureCard icon={<Ship size={19} />} title={t(lang, "landing_feature_shipping_title")} body={t(lang, "landing_feature_shipping_body")} />
          <FeatureCard icon={<Languages size={19} />} title={t(lang, "landing_feature_lang_title")} body={t(lang, "landing_feature_lang_body")} />
        </StaggerGroup>
      </section>

      {/* ---------- honesty ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <Reveal>
          <div className="glass-card glass-glow overflow-hidden p-8 sm:p-12" style={{ borderColor: "var(--gold-ring)" }}>
            <span className="eyebrow" style={{ background: "var(--gold-soft)", color: "var(--gold)", borderColor: "var(--gold-ring)" }}>
              <ShieldCheck size={13} /> {t(lang, "landing_honesty_eyebrow")}
            </span>
            <h2 className="font-display mt-4 max-w-2xl text-2xl sm:text-[2rem]">
              {t(lang, "landing_honesty_title")}
            </h2>
            <p className="mt-4 max-w-2xl text-base muted">{t(lang, "landing_honesty_body")}</p>
          </div>
        </Reveal>
      </section>

      {/* ---------- also in plotproof ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-4 sm:px-8">
        <Reveal>
          <h2 className="text-xs font-semibold uppercase tracking-wide faint">{t(lang, "landing_also_title")}</h2>
        </Reveal>
        <StaggerGroup className="mt-4 grid gap-4 sm:grid-cols-2">
          <StaggerItem>
            <motion.div {...hoverLift}>
              <Link href="/explore" className="glass flex items-start gap-3 p-5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <MapPin size={17} />
                </span>
                <span>
                  <span className="block font-semibold">{t(lang, "nav_explore")}</span>
                  <span className="block text-sm muted">{t(lang, "landing_explore_desc")}</span>
                </span>
              </Link>
            </motion.div>
          </StaggerItem>
          <StaggerItem>
            <motion.div {...hoverLift}>
              <Link href="/acoustic" className="glass flex items-start gap-3 p-5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <AudioLines size={17} />
                </span>
                <span>
                  <span className="block font-semibold">{t(lang, "footer_acoustic")}</span>
                  <span className="block text-sm muted">{t(lang, "landing_acoustic_desc")}</span>
                </span>
              </Link>
            </motion.div>
          </StaggerItem>
        </StaggerGroup>
      </section>

      {/* ---------- final cta ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <Reveal>
          <div className="glass-card glass-glow flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12">
            <div>
              <h2 className="font-display text-2xl sm:text-[2rem]">{t(lang, "landing_final_cta_title")}</h2>
              <p className="mt-2 muted">{t(lang, "landing_final_cta_sub")}</p>
            </div>
            <Magnetic>
              <Link href={primaryHref} className="btn btn-primary btn-lg">
                {primaryLabel} <ArrowRight size={17} />
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--accent)" }}>
        <Counter to={value} />
      </div>
      <div className="mt-1 text-sm muted">{label}</div>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <motion.div {...hoverLift} className="glass-card h-full p-5">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        {icon}
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1.5 text-sm muted">{body}</p>
    </motion.div>
  );
}
