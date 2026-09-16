"use client";

/**
 * The new front door: a farmer answers what they grow, where they are, where
 * they want to sell, and how much, and gets the exact documents they need to
 * export legally and sell direct, plus shipping options. Written for both
 * tech-comfortable and traditional farmers: short sentences, big choices, plain
 * words, one decision per step.
 *
 * Layout follows the question, not the other way round. While the wizard runs,
 * a left rail holds the page's identity and the answers so far, and the whole
 * right column belongs to the ONE question being asked. The rail sits outside
 * the animated step region on purpose: it re-renders on the same tick a choice
 * is made, so a tap is acknowledged before the step has finished moving.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Pencil, RotateCcw } from "lucide-react";
import { CATALOG_VERIFIED_AT, DOCUMENT_TYPES, MARKETS, PRODUCTS, getProduct } from "@/lib/compliance/catalog";
import { classify } from "@/lib/compliance/hs";
import { resolveRequirements } from "@/lib/compliance/resolver";
import { suggestShipping } from "@/lib/compliance/shipping";
import { saveIntent, loadIntent, clearIntent } from "@/lib/compliance/intent";
import { getStatuses, setStatus, clearAllStatuses, type StatusMap } from "@/lib/compliance/status";
import { pushUserState } from "@/lib/supabase/userState";
import { countryName } from "@/lib/geo/countries";
import { t, useLang } from "@/lib/i18n";
import DocumentChecklist from "@/components/compliance/DocumentChecklist";
import PriceCard from "@/components/sell/PriceCard";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Breadcrumb from "@/components/shell/Breadcrumb";
import { useToast } from "@/components/shell/Toast";
import Reveal from "@/components/motion/Reveal";
import { stepTransition } from "@/lib/motion/variants";
import type { DocStatus, Market, SaleIntent } from "@/lib/compliance/types";

const ORIGINS = ["LK", "ID", "VN", "PH", "IN", "KE", "CI", "GH"];

/** One hairline value, everywhere a rule does structural work. */
const HAIRLINE: CSSProperties = { borderColor: "var(--glass-hairline)" };

const STEP_KEYS = ["q_product", "q_origin", "q_market", "q_details"] as const;

export default function SellPage() {
  const lang = useLang();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState<string | null>(null);
  const [hsText, setHsText] = useState("");
  const [origin, setOrigin] = useState<string | null>(null);
  const [destination, setDestination] = useState<Market | null>(null);
  const [quantityKg, setQuantityKg] = useState<string>("");
  const [organic, setOrganic] = useState(false);
  const [statuses, setStatuses] = useState<StatusMap>({});
  // True once a sale has been saved. When true, opening /sell shows the saved
  // sale (not a blank form), the farmer must explicitly Change or Reset it.
  const [committed, setCommitted] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current); }, []);

  // On first load, if a sale is already saved, restore it and jump straight to
  // the results, so a returning farmer never lands back on a blank wizard.
  useEffect(() => {
    const saved = loadIntent();
    if (!saved) return;
    setProductId(saved.productId);
    setOrigin(saved.originCountry);
    setDestination(saved.destination);
    setQuantityKg(saved.quantityKg ? String(saved.quantityKg) : "");
    setOrganic(saved.organicClaim);
    setStatuses(getStatuses(saved));
    setCommitted(true);
    setStep(5);
  }, []);

  // The intent as it stands (null until the wizard has enough to identify a sale).
  const intent: SaleIntent | null = useMemo(
    () =>
      productId && origin && destination
        ? {
            productId,
            originCountry: origin,
            destination,
            quantityKg: Number(quantityKg) || 0,
            organicClaim: organic,
            createdAt: "",
          }
        : null,
    [productId, origin, destination, quantityKg, organic],
  );

  // Returning to a sale the farmer already worked on restores its progress.
  useEffect(() => {
    if (intent) setStatuses(getStatuses(intent));
  }, [intent]);

  const onSetStatus = useCallback(
    (documentTypeId: string, status: DocStatus) => {
      if (intent) {
        setStatuses(setStatus(intent, documentTypeId, status));
        pushUserState();
      }
    },
    [intent],
  );

  const product = productId ? getProduct(productId) : undefined;
  const hsCandidates = useMemo(
    () => (hsText.trim() ? classify(hsText, PRODUCTS) : []),
    [hsText],
  );

  const result = useMemo(() => {
    if (!product || !origin || !destination) return null;
    return resolveRequirements(
      { product, originCountry: origin, destination, organicClaim: organic },
      DOCUMENT_TYPES,
    );
  }, [product, origin, destination, organic]);

  const shipping = useMemo(() => {
    if (!product || !destination) return [];
    return suggestShipping(product, Number(quantityKg) || 0, destination);
  }, [product, destination, quantityKg]);

  const goResults = () => {
    if (product && origin && destination) {
      saveIntent({
        productId: product.id,
        originCountry: origin,
        destination,
        quantityKg: Number(quantityKg) || 0,
        organicClaim: organic,
        createdAt: new Date().toISOString(),
      });
      pushUserState();
      setCommitted(true);
      setStep(5);
      toast(t(lang, "toast_checklist_ready"), "success");
    }
  };

  // Edit the saved sale: re-open the wizard, prefilled with the current values.
  const changeInfo = () => setStep(1);

  // Reset: discard the saved sale + all document progress, back to a blank form.
  const resetInfo = () => {
    clearIntent();
    clearAllStatuses();
    pushUserState();
    setProductId(null);
    setHsText("");
    setOrigin(null);
    setDestination(null);
    setQuantityKg("");
    setOrganic(false);
    setStatuses({});
    setCommitted(false);
    setResetArmed(false);
    setStep(1);
    toast(t(lang, "toast_reset"), "success");
  };

  const destinationName = MARKETS.find((m) => m.code === destination)?.name ?? destination;
  // What the rail echoes back. Recomputed every render, so a choice shows up in
  // the index the instant it is made.
  const answers: (string | null)[] = [
    product?.name ?? null,
    origin ? countryName(origin) : null,
    destination ? destinationName : null,
    quantityKg ? `${(Number(quantityKg) || 0).toLocaleString()} kg` : null,
  ];

  // Steps swap instantly; the transition is a short slide, never a spinner,
  // because nothing is being fetched. Reduced motion gets a plain swap.
  const stepMotion: MotionProps = reduce
    ? {}
    : { variants: stepTransition, initial: "initial", animate: "enter", exit: "exit" };

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-7 sm:px-8 sm:pt-9">
      <div className="flex items-center justify-between gap-4">
        <Breadcrumb items={[{ label: t(lang, "nav_home"), href: "/" }, { label: t(lang, "nav_sell") }]} />
        <LanguageSwitcher />
      </div>

      {step < 5 && (
        <div
          className="mt-7 grid gap-x-16 gap-y-8 border-t pt-8 sm:mt-8 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
          style={HAIRLINE}
        >
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <h1 className="text-[1.05rem] font-semibold tracking-tight">{t(lang, "sell_title")}</h1>
            <p className="mt-2 max-w-[42ch] text-sm muted">{t(lang, "sell_sub")}</p>

            {committed && (
              <button
                onClick={() => setStep(5)}
                className="-ml-1 mt-4 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-sm faint transition-colors duration-150 hover:text-[var(--fg)]"
              >
                <ArrowLeft size={15} aria-hidden="true" /> {t(lang, "back")}
              </button>
            )}

            {/* Desktop: a real index of the four questions. A completed step
                shows its answer and goes back to it in one click. */}
            <ol className="mt-7 hidden lg:block">
              {STEP_KEYS.map((key, i) => {
                const n = i + 1;
                const current = n === step;
                const reachable = n < step || answers[i] !== null;
                const rail: CSSProperties = {
                  borderColor: current
                    ? "var(--accent)"
                    : answers[i]
                      ? "var(--accent-ring)"
                      : "var(--glass-hairline)",
                };
                const inner = (
                  <>
                    <span
                      className="w-4 shrink-0 pt-px text-xs font-semibold tabular-nums"
                      style={{ color: current ? "var(--accent)" : "var(--fg-faint)" }}
                    >
                      {n}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm leading-snug ${current ? "font-semibold" : "muted"}`}>
                        {t(lang, key)}
                      </span>
                      {answers[i] && (
                        <span className="mt-0.5 block truncate text-xs faint">{answers[i]}</span>
                      )}
                    </span>
                  </>
                );
                return (
                  <li key={key}>
                    {reachable && !current ? (
                      <button
                        onClick={() => setStep(n)}
                        className="flex w-full items-start gap-3 border-l-2 py-3 pl-4 text-left transition-colors duration-150 hover:bg-[var(--glass-hairline)]"
                        style={rail}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div
                        className="flex items-start gap-3 border-l-2 py-3 pl-4"
                        style={rail}
                        aria-current={current ? "step" : undefined}
                      >
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {/* Mobile: position only, four hairline segments, no fake weight. */}
            <div className="mt-6 lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] tabular-nums faint">
                {step} / {STEP_KEYS.length}
              </p>
              <div className="mt-2 flex gap-1.5" aria-hidden="true">
                {STEP_KEYS.map((key, i) => (
                  <span
                    key={key}
                    className="h-[3px] flex-1 rounded-full transition-colors duration-300"
                    style={{
                      background:
                        i + 1 === step
                          ? "var(--accent)"
                          : i + 1 < step || answers[i]
                            ? "var(--accent-ring)"
                            : "var(--glass-hairline)",
                    }}
                  />
                ))}
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              {/* 1. product */}
              {step === 1 && (
                <motion.section key="s1" {...stepMotion}>
                  <Question>{t(lang, "q_product")}</Question>
                  <div className="mt-7 grid border-b sm:grid-cols-2" style={HAIRLINE}>
                    {PRODUCTS.map((p, i) => (
                      <ChoiceRow
                        key={p.id}
                        active={productId === p.id}
                        label={p.name}
                        trailing={`HS ${p.hsCode}`}
                        className={`border-t ${i % 2 === 0 ? "sm:border-r" : ""}`}
                        onClick={() => {
                          setProductId(p.id);
                          setStep(2);
                        }}
                      />
                    ))}
                  </div>

                  <div className="mt-10 max-w-[34rem]">
                    <label className="label" htmlFor="hs-text">{t(lang, "q_product_free")}</label>
                    <input
                      id="hs-text"
                      value={hsText}
                      onChange={(e) => setHsText(e.target.value)}
                      placeholder={t(lang, "q_product_placeholder")}
                      className="field"
                    />
                    {/* Matches are derived synchronously from the typing, so they
                        are announced, not spinner-gated. */}
                    <div aria-live="polite">
                      {hsCandidates.length > 0 && (
                        <div className="mt-4 border-b" style={HAIRLINE}>
                          {hsCandidates.map((c) => (
                            <ChoiceRow
                              key={c.productId}
                              active={productId === c.productId}
                              label={c.name}
                              sub={`HS ${c.hsCode}`}
                              trailing={`${Math.round(c.score * 100)}% match`}
                              className="border-t"
                              onClick={() => {
                                setProductId(c.productId);
                                setStep(2);
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.section>
              )}

              {/* 2. origin */}
              {step === 2 && (
                <motion.section key="s2" {...stepMotion}>
                  <Question>{t(lang, "q_origin")}</Question>
                  <div className="mt-7 grid border-b sm:grid-cols-2" style={HAIRLINE}>
                    {ORIGINS.map((c, i) => (
                      <ChoiceRow
                        key={c}
                        active={origin === c}
                        label={countryName(c)}
                        trailing={c}
                        className={`border-t ${i % 2 === 0 ? "sm:border-r" : ""}`}
                        onClick={() => {
                          setOrigin(c);
                          setStep(3);
                        }}
                      />
                    ))}
                  </div>
                  <Back onClick={() => setStep(1)} />
                </motion.section>
              )}

              {/* 3. destination */}
              {step === 3 && (
                <motion.section key="s3" {...stepMotion}>
                  <Question>{t(lang, "q_market")}</Question>
                  <div className="mt-7 border-b" style={HAIRLINE}>
                    {MARKETS.map((m) => (
                      <ChoiceRow
                        key={m.code}
                        active={destination === m.code}
                        label={m.name}
                        sub={m.note}
                        trailing={m.code}
                        className="border-t"
                        onClick={() => {
                          setDestination(m.code);
                          setStep(4);
                        }}
                      />
                    ))}
                  </div>
                  <Back onClick={() => setStep(2)} />
                </motion.section>
              )}

              {/* 4. details */}
              {step === 4 && (
                <motion.section key="s4" {...stepMotion}>
                  <Question>{t(lang, "q_details")}</Question>
                  <div className="mt-8 max-w-[34rem]">
                    <label className="label" htmlFor="qty">{t(lang, "qty_label")}</label>
                    <div className="relative">
                      <input
                        id="qty"
                        inputMode="numeric"
                        value={quantityKg}
                        onChange={(e) => setQuantityKg(e.target.value)}
                        placeholder={t(lang, "qty_placeholder")}
                        className="field pr-14 text-2xl font-semibold tabular-nums"
                      />
                      <span
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm faint"
                        aria-hidden="true"
                      >
                        kg
                      </span>
                    </div>

                    <label
                      className="mt-7 flex min-h-[56px] cursor-pointer items-center gap-3 border-y py-3 text-sm transition-colors duration-150 hover:bg-[var(--glass-hairline)]"
                      style={HAIRLINE}
                    >
                      <input
                        type="checkbox"
                        checked={organic}
                        onChange={(e) => setOrganic(e.target.checked)}
                        className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                      />
                      {t(lang, "organic_label")}
                    </label>

                    <button onClick={goResults} className="btn btn-primary btn-lg mt-8 w-full sm:w-auto">
                      {t(lang, "show_btn")} <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                  <Back onClick={() => setStep(3)} />
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* 5. results */}
      {step === 5 && result && product && origin && destination && (
        <div className="mt-7 border-t pt-8 sm:mt-8" style={HAIRLINE}>
          <Reveal>
            <header>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] faint">
                {product.name} · HS {product.hsCode} · {countryName(origin)} → {destination}
              </p>
              <div className="mt-6 grid gap-x-12 gap-y-5 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end">
                <div>
                  <div
                    className="font-display text-[4.5rem] leading-[0.82] tabular-nums sm:text-[5.5rem]"
                    style={{ color: "var(--accent)" }}
                  >
                    {result.summary.total}
                  </div>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] faint">
                    {t(lang, "documents_title")}
                  </div>
                </div>
                <p className="max-w-[58ch] text-[1.05rem] leading-[1.55] sm:text-lg">
                  {t(lang, "summary", {
                    product: `${product.name} (HS ${product.hsCode})`,
                    origin: countryName(origin),
                    dest: destination,
                    total: result.summary.total,
                    self: result.summary.selfServe,
                    auth: result.summary.authority,
                  })}
                </p>
              </div>

              <dl className="mt-10 grid grid-cols-2 border-t" style={HAIRLINE}>
                <div className="py-4 pr-6">
                  <dt className="text-xs uppercase tracking-[0.14em] faint">{t(lang, "group_self")}</dt>
                  <dd className="mt-2 text-2xl font-semibold tabular-nums">{result.summary.selfServe}</dd>
                </div>
                <div className="border-l py-4 pl-6" style={HAIRLINE}>
                  <dt className="text-xs uppercase tracking-[0.14em] faint">{t(lang, "group_authority")}</dt>
                  <dd className="mt-2 text-2xl font-semibold tabular-nums">{result.summary.authority}</dd>
                </div>
              </dl>
            </header>
          </Reveal>

          <div className="mt-14 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
            {/* The price is the one genuinely elevated surface here, and it
                stays in view while the farmer works down the checklist. */}
            <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:self-start">
              <PriceCard productId={product.id} quantityKg={Number(quantityKg) || undefined} />
            </aside>

            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
              {/* EUDR applies to only 3 of the 8 catalog products; say which lane
                  this sale is in rather than implying one law covers everything. */}
              <p
                className="max-w-[68ch] border-l-2 pl-4 text-sm leading-[1.6]"
                style={{ borderColor: "var(--accent)" }}
              >
                {t(lang, product.eudrCovered ? "results_eudr_covered" : "results_eudr_not_covered")}
              </p>

              <div className="mt-10">
                <DocumentChecklist documents={result.documents} statuses={statuses} onSetStatus={onSetStatus} />
              </div>

              {/* The honest ending: who ships, who files, and what the farmer's
                  leverage actually is — instead of a checklist that dead-ends. */}
              <section className="mt-14 border-t pt-8" style={HAIRLINE}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] faint">
                  {t(lang, "results_next_title")}
                </h2>
                <p className="mt-3 max-w-[68ch] text-[0.95rem] leading-[1.65] muted">
                  {t(lang, "results_next_body")}
                </p>
              </section>

              <section className="mt-12">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] faint">
                  {t(lang, "shipping_title")}
                </h2>
                <ul className="mt-4 border-t" style={HAIRLINE}>
                  {shipping.map((s) => (
                    <li
                      key={s.mode}
                      className="grid gap-x-10 gap-y-2 border-b py-5 sm:grid-cols-[11rem_minmax(0,1fr)]"
                      style={HAIRLINE}
                    >
                      <h3 className="text-sm font-semibold">{s.label}</h3>
                      <div className="max-w-[66ch]">
                        <p className="text-sm muted">{s.rationale}</p>
                        <p className="mt-1.5 text-xs faint">
                          Suggested terms: {s.incoterm} · transit {s.transit}
                        </p>
                        <p className="mt-0.5 text-xs faint">{s.notes}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Fine print, gathered and quiet — never smaller than it was,
                  never reworded, and the stale case still shouts. */}
              <div className="mt-12 border-t pt-6" style={HAIRLINE}>
                <p
                  className="max-w-[72ch] border-l-2 pl-3 text-xs leading-[1.65] muted"
                  style={{ borderColor: "var(--warn)" }}
                >
                  {t(lang, "disclaimer")}
                </p>
                <div className="mt-3 max-w-[72ch]">
                  <CatalogFreshness lang={lang} />
                </div>
                {lang !== "en" && (
                  <p className="mt-2 max-w-[72ch] text-xs faint">{t(lang, "docs_in_english")}</p>
                )}
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-6" style={HAIRLINE}>
                <button onClick={changeInfo} className="btn btn-ghost btn-sm">
                  <Pencil size={14} aria-hidden="true" /> {t(lang, "sell_change")}
                </button>
                {resetArmed ? (
                  <button onClick={resetInfo} className="btn btn-danger btn-sm">
                    <RotateCcw size={14} aria-hidden="true" /> {t(lang, "sell_reset_confirm")}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setResetArmed(true);
                      if (armTimer.current) clearTimeout(armTimer.current);
                      armTimer.current = setTimeout(() => setResetArmed(false), 4000);
                    }}
                    className="min-h-[38px] text-sm faint underline underline-offset-4 transition-colors duration-150 hover:text-[var(--fg)]"
                  >
                    {t(lang, "sell_reset")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** The one thing on screen while the wizard runs. */
function Question({ children }: { children: ReactNode }) {
  return <h2 className="font-display max-w-[18ch] text-[2rem] leading-[1.08] sm:text-[2.5rem]">{children}</h2>;
}

/**
 * A full-width answer row. Selecting is instant and synchronous, so the press IS
 * the feedback: the row tints on :active before the handler runs, the chosen row
 * keeps an accent edge and a check, and the rail updates on the same tick. No
 * spinner, because nothing is loading.
 */
function ChoiceRow({
  active,
  label,
  sub,
  trailing,
  onClick,
  className = "",
}: {
  active: boolean;
  label: string;
  sub?: string;
  trailing?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex min-h-[60px] w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors duration-150 ${
        active ? "" : "hover:bg-[var(--glass-hairline)] active:bg-[var(--accent-soft)]"
      } ${className}`}
      style={active ? { ...HAIRLINE, background: "var(--accent-soft)" } : HAIRLINE}
    >
      {active && (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{ background: "var(--accent)" }} />
      )}
      <span className="min-w-0">
        <span className={`block text-[0.95rem] ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
        {sub && <span className="mt-0.5 block text-xs leading-snug faint">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        {trailing && <span className="text-xs tabular-nums faint">{trailing}</span>}
        {/* Always in the layout, only opacity changes, so choosing a row can
            never nudge the row the farmer just aimed at. */}
        <Check
          size={16}
          aria-hidden="true"
          className="transition-opacity duration-150"
          style={{ color: "var(--accent)", opacity: active ? 1 : 0 }}
        />
      </span>
    </button>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  const lang = useLang();
  return (
    <button
      onClick={onClick}
      className="-ml-1 mt-8 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-sm faint transition-colors duration-150 hover:text-[var(--fg)]"
    >
      <ArrowLeft size={15} aria-hidden="true" />
      {t(lang, "back")}
    </button>
  );
}

/** "Requirements last verified {date}" with a loud warning once it's stale.
 *  Mirrors the price staleness gate: legal claims carry their freshness. */
function CatalogFreshness({ lang }: { lang: import("@/lib/i18n/strings").Lang }) {
  const ageMonths =
    (Date.now() - new Date(CATALOG_VERIFIED_AT).getTime()) / (30.44 * 24 * 3600 * 1000);
  const stale = ageMonths > 6;
  return (
    <p
      className="text-xs leading-[1.6]"
      style={stale ? { color: "var(--warn)" } : { color: "var(--fg-faint)" }}
    >
      {t(lang, stale ? "catalog_stale_warning" : "catalog_verified_note", {
        date: CATALOG_VERIFIED_AT,
      })}
    </p>
  );
}
