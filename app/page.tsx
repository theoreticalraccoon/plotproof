"use client";

/** The homepage: what an export certification officer gets, shown with the product's own paperwork. */
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Check, Circle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { t, useLang, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/AuthProvider";
import { PRODUCTS, MARKETS } from "@/lib/compliance/catalog";
import { LANGS } from "@/lib/i18n/strings";
import PendingLink from "@/components/motion/PendingLink";
import DocPreview from "@/components/documents/DocPreview";
import { buildDoc } from "@/lib/sale/documents";
import { newSale } from "@/lib/sale/model";
import type { Sale } from "@/lib/sale/types";

const HAIRLINE: CSSProperties = { borderColor: "var(--glass-hairline)" };
const EASE = [0.16, 1, 0.3, 1] as const;

// A fixed example so the server and browser render the same invoice. Labelled as an example on the page.
const EXAMPLE_DATE = "2026-09-18";
const EXAMPLE: Sale = {
  ...newSale(new Date(`${EXAMPLE_DATE}T08:00:00Z`), "example"),
  exporter: { name: "Uva Highlands Tea Exports (Pvt) Ltd", address: "12 Lake Road\nBadulla", contact: "+94 55 222 0000", rexNumber: "" },
  farmer: { name: "K. Perera", nic: "", village: "Haputale" },
  buyer: { name: "Hamburg Tee GmbH", address: "Speicherstadt 4\n20457 Hamburg", contact: "", country: "DE" },
  productId: "black_tea",
  productDescription: "BOP1 Ceylon black tea, 2026 crop",
  destination: "EU",
  packages: 40,
  packageType: "Paper sacks",
  netKgPerPackage: 50,
  grossKgPerPackage: 51.2,
  marks: "UHT/HAM/0918",
  unitPricePerKg: 4.8,
  paymentTerms: "30% advance, 70% against documents",
  portOfDischarge: "Hamburg, Germany",
  vesselOrFlight: "MSC Tianjin",
  shipmentDate: "2026-10-02",
};
const INVOICE = buildDoc("invoice", EXAMPLE, EXAMPLE_DATE, false);
const PACKING = buildDoc("packing-list", EXAMPLE, EXAMPLE_DATE, false);

const STEPS = [1, 2, 3, 4, 5] as const;

export default function Home() {
  const lang = useLang();
  const en = lang === "en";
  const { configured, user } = useAuth();
  const startHref = !configured || user ? "/sell" : "/signup?next=%2Fsell";

  const display = (size: string, tight = 1.02): CSSProperties => ({
    fontSize: size,
    lineHeight: en ? tight : tight + 0.2,
    letterSpacing: en ? "-0.03em" : "0",
  });

  return (
    <>
      {/* hero */}
      <section className="mx-auto max-w-6xl overflow-x-clip px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20">
        <div className="grid gap-y-14 lg:grid-cols-12 lg:items-center lg:gap-x-10">
          <div className="lg:col-span-6">
            <h1 className="font-display max-w-[15ch] text-balance" style={display("clamp(2.5rem, 5.4vw, 4.25rem)")}>
              {t(lang, "home_title")}
            </h1>
            <p className="mt-7 max-w-[46ch] text-[1.125rem] leading-[1.6] muted" style={{ textWrap: "pretty" } as CSSProperties}>
              {t(lang, "home_lede")}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <PendingLink href={startHref} className="btn btn-primary btn-lg">
                <span className="inline-flex items-center gap-2">
                  {t(lang, "home_cta_start")}
                  <ArrowRight size={17} aria-hidden="true" />
                </span>
              </PendingLink>
              <a
                href="#how"
                className="inline-flex min-h-[44px] items-center text-[0.95rem] font-medium underline decoration-[color:var(--glass-hairline)] decoration-1 underline-offset-[6px] transition-colors duration-150 hover:decoration-[color:var(--accent)]"
                style={{ color: "var(--fg-muted)" }}
              >
                {t(lang, "home_cta_how")}
              </a>
            </div>

            <dl className="mt-12 flex flex-wrap gap-x-9 gap-y-3 border-t pt-5" style={HAIRLINE}>
              {[
                [PRODUCTS.length, "home_stat_crops"],
                [MARKETS.length, "home_stat_markets"],
                [LANGS.length, "home_stat_languages"],
              ].map(([n, key]) => (
                <div key={key} className="flex items-baseline gap-2">
                  <dt className="sr-only">{t(lang, String(key))}</dt>
                  <dd className="text-[1.25rem] font-semibold tabular-nums" style={{ letterSpacing: "-0.02em" }}>
                    {n}
                  </dd>
                  <span aria-hidden="true" className="text-[0.85rem] muted">
                    {t(lang, String(key))}
                  </span>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-6">
            <Papers lang={lang} />
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="scroll-mt-24 border-t" style={HAIRLINE}>
        <div className="mx-auto grid max-w-6xl gap-y-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12 lg:gap-x-10">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-[calc(var(--nav-h)+2.5rem)]">
              <h2 className="font-display max-w-[14ch] text-balance" style={display("clamp(1.9rem, 3.4vw, 2.6rem)", 1.06)}>
                {t(lang, "home_how_title")}
              </h2>
              <p className="mt-5 max-w-[36ch] text-[1rem] leading-relaxed muted">{t(lang, "home_how_lede")}</p>
            </div>
          </div>
          <ol className="lg:col-span-7 lg:col-start-6">
            {STEPS.map((n) => (
              <li
                key={n}
                className="grid grid-cols-[2.25rem_1fr] gap-x-4 border-t py-6 first:border-t-0 first:pt-0 sm:py-7"
                style={HAIRLINE}
              >
                <span className="pt-[0.15rem] text-[0.85rem] font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
                  {n}
                </span>
                <div>
                  <h3 className="text-[1.15rem] font-semibold leading-snug" style={{ letterSpacing: "-0.01em" }}>
                    {t(lang, `home_step_${n}_title`)}
                  </h3>
                  <p className="mt-2 max-w-[58ch] text-[0.975rem] leading-relaxed muted">{t(lang, `home_step_${n}_body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* EUDR: two real results */}
      <section className="border-y" style={{ ...HAIRLINE, background: "var(--bg-1)" }}>
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-y-5 lg:grid-cols-12 lg:gap-x-10">
            <h2 className="font-display text-balance lg:col-span-6" style={display("clamp(1.9rem, 3.4vw, 2.6rem)", 1.06)}>
              {t(lang, "home_eudr_title")}
            </h2>
            <p className="max-w-[48ch] self-end text-[1rem] leading-relaxed muted lg:col-span-5 lg:col-start-8">
              {t(lang, "home_eudr_lede")}
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Slip
              lang={lang}
              name={t(lang, "home_eudr_a_name")}
              size={t(lang, "home_eudr_a_size")}
              rows={[
                [t(lang, "home_eudr_forest"), "1.22 ha"],
                [t(lang, "home_eudr_lost"), "0 ha"],
              ]}
              result={t(lang, "home_eudr_a_result")}
              tone="warn"
              note={t(lang, "home_eudr_a_note")}
            />
            <Slip
              lang={lang}
              name={t(lang, "home_eudr_b_name")}
              size={t(lang, "home_eudr_b_size")}
              rows={[
                [t(lang, "home_eudr_forest"), "326 ha"],
                [t(lang, "home_eudr_lost"), "5.21 ha"],
                [t(lang, "home_eudr_cause"), t(lang, "home_eudr_cause_farming")],
              ]}
              result={t(lang, "home_eudr_b_result")}
              tone="danger"
              note={t(lang, "home_eudr_b_note")}
            />
          </div>
          <p className="mt-6 max-w-[70ch] text-[0.85rem] leading-relaxed faint">{t(lang, "home_eudr_foot")}</p>
        </div>
      </section>

      {/* for the farm */}
      <section className="mx-auto grid max-w-6xl gap-y-8 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12 lg:gap-x-10">
        <h2 className="font-display max-w-[12ch] text-balance lg:col-span-4" style={display("clamp(1.9rem, 3.4vw, 2.6rem)", 1.06)}>
          {t(lang, "home_farm_title")}
        </h2>
        <ul className="lg:col-span-7 lg:col-start-6">
          <FarmRow href="/grow" title={t(lang, "home_farm_grow_title")} body={t(lang, "home_farm_grow_body")} />
          <FarmRow href="/grow/diagnose" title={t(lang, "home_farm_leaf_title")} body={t(lang, "home_farm_leaf_body")} />
          <FarmRow href="/grow/sensor" title={t(lang, "home_farm_probe_title")} body={t(lang, "home_farm_probe_body")} />
        </ul>
      </section>

      {/* the rule, then the way in */}
      <section className="border-t" style={HAIRLINE}>
        <div className="mx-auto grid max-w-6xl gap-y-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12 lg:gap-x-10">
          <div className="lg:col-span-5">
            <h2 className="font-display text-balance" style={{ ...display("clamp(1.6rem, 2.6vw, 2rem)", 1.1), color: "var(--gold)" }}>
              {t(lang, "home_rule_title")}
            </h2>
            <p className="mt-4 max-w-[44ch] text-[1rem] leading-relaxed muted">{t(lang, "home_rule_body")}</p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7 lg:self-end">
            <h2 className="font-display text-balance" style={display("clamp(2rem, 3.8vw, 2.9rem)", 1.04)}>
              {t(lang, "home_final_title")}
            </h2>
            <p className="mt-4 max-w-[44ch] text-[1rem] leading-relaxed muted">{t(lang, "home_final_body")}</p>
            <PendingLink href={startHref} className="btn btn-primary btn-lg mt-8">
              <span className="inline-flex items-center gap-2">
                {t(lang, "home_cta_start")}
                <ArrowRight size={17} aria-hidden="true" />
              </span>
            </PendingLink>
          </div>
        </div>
      </section>
    </>
  );
}

/** The hero picture: the example's packing list and invoice, with the authority checklist on top. */
function Papers({ lang }: { lang: Lang }) {
  const reduce = useReducedMotion();
  // Starts visible and settles into place: the page's one piece of motion.
  const settle = (i: number, rotate: number) =>
    reduce
      ? { style: { rotate } }
      : {
          initial: { y: 18, rotate: rotate - 1.2 },
          animate: { y: 0, rotate },
          transition: { duration: 1.1, delay: 0.12 * i, ease: EASE },
        };
  const sheet = "absolute w-[520px] origin-top-left rounded-[6px] shadow-[0_18px_40px_-18px_rgba(16,22,15,0.35),0_2px_6px_rgba(16,22,15,0.06)]";

  return (
    <figure className="m-0">
      <div role="img" aria-label={t(lang, "home_example_caption")} className="relative mx-auto h-[29rem] max-w-[34rem] sm:h-[37rem]">
        <div aria-hidden="true" className="absolute inset-0">
          {/* The sheets run off the bottom of the frame and fade, like papers under the checklist. */}
          <div
            className="absolute inset-x-[-2rem] inset-y-0 overflow-hidden"
            style={{ maskImage: "linear-gradient(to bottom, #000 74%, transparent 97%)", WebkitMaskImage: "linear-gradient(to bottom, #000 74%, transparent 97%)" }}
          >
            <motion.div {...settle(0, -4)} className={`${sheet} left-[calc(2%+2rem)] top-[4%] scale-[0.6] sm:scale-[0.72]`}>
              <DocPreview doc={PACKING} />
            </motion.div>
            <motion.div {...settle(1, 2)} className={`${sheet} left-[calc(16%+2rem)] top-[13%] scale-[0.6] sm:scale-[0.72]`}>
              <DocPreview doc={INVOICE} />
            </motion.div>
          </div>
          <motion.div
            {...settle(2, -1.5)}
            className="absolute bottom-0 left-0 w-[16.5rem] rounded-[14px] p-4 shadow-[0_22px_44px_-20px_rgba(16,22,15,0.4),0_2px_6px_rgba(16,22,15,0.07)]"
            style={{ background: "var(--bg-0)" }}
          >
            <p className="text-[0.78rem] font-semibold" style={{ color: "var(--fg-muted)" }}>
              {t(lang, "home_slip_title")}
            </p>
            <ChecklistRow done title={t(lang, "home_slip_phyto")} by={t(lang, "home_slip_phyto_by")} state={t(lang, "home_slip_done")} />
            <ChecklistRow title={t(lang, "home_slip_cusdec")} by={t(lang, "home_slip_cusdec_by")} state={t(lang, "home_slip_todo")} />
          </motion.div>
        </div>
      </div>
      <figcaption className="mt-5 text-center text-[0.8rem] faint lg:text-left">{t(lang, "home_example_caption")}</figcaption>
    </figure>
  );
}

function ChecklistRow({ title, by, state, done }: { title: string; by: string; state: string; done?: boolean }) {
  return (
    <div className="mt-3 flex items-start gap-2.5 border-t pt-3" style={HAIRLINE}>
      <span
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
        style={{ background: done ? "var(--accent)" : "transparent", color: done ? "var(--accent-fg)" : "var(--fg-faint)" }}
      >
        {done ? <Check size={12} strokeWidth={3} /> : <Circle size={16} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.86rem] font-medium leading-snug">{title}</span>
        <span className="block text-[0.75rem] faint">{by}</span>
      </span>
      <span className="shrink-0 text-[0.72rem] font-medium" style={{ color: done ? "var(--accent)" : "var(--warn)" }}>
        {state}
      </span>
    </div>
  );
}

/** One screened plot, as the officer sees it. */
function Slip({
  name,
  size,
  rows,
  result,
  tone,
  note,
}: {
  lang: Lang;
  name: string;
  size: string;
  rows: [string, string][];
  result: string;
  tone: "warn" | "danger";
  note: string;
}) {
  const color = tone === "warn" ? "var(--warn)" : "var(--danger)";
  const soft = tone === "warn" ? "var(--warn-soft)" : "var(--danger-soft)";
  return (
    <article
      className="flex flex-col rounded-[14px] p-6 shadow-[0_14px_34px_-22px_rgba(16,22,15,0.35)] sm:p-7"
      style={{ background: "var(--bg-0)" }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[1.1rem] font-semibold" style={{ letterSpacing: "-0.01em" }}>
          {name}
        </h3>
        <span className="shrink-0 text-[0.85rem] tabular-nums faint">{size}</span>
      </div>
      <dl className="mt-5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 border-t py-2.5" style={HAIRLINE}>
            <dt className="text-[0.9rem] muted">{k}</dt>
            <dd className="text-[0.95rem] font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 inline-flex self-start rounded-full px-3 py-1 text-[0.8rem] font-semibold" style={{ background: soft, color }}>
        {result}
      </p>
      <p className="mt-3 text-[0.9rem] leading-relaxed muted">{note}</p>
    </article>
  );
}

function FarmRow({ href, title, body }: { href: string; title: string; body: string }): ReactNode {
  return (
    <li className="border-t first:border-t-0" style={HAIRLINE}>
      <PendingLink
        href={href}
        className="group -mx-3 block rounded-[var(--radius-sm)] px-3 py-5 transition-colors duration-150 hover:bg-[var(--accent-soft)]"
      >
        <span className="block">
          <span className="flex items-center gap-2 text-[1.05rem] font-semibold">
            {title}
            <ArrowUpRight
              size={16}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              style={{ color: "var(--accent)" }}
            />
          </span>
          <span className="mt-1.5 block max-w-[60ch] text-[0.95rem] leading-relaxed muted">{body}</span>
        </span>
      </PendingLink>
    </li>
  );
}
