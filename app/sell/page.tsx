"use client";

/**
 * The new front door: a farmer answers what they grow, where they are, where
 * they want to sell, and how much, and gets the exact documents they need to
 * export legally and sell direct, plus shipping options. Written for both
 * tech-comfortable and traditional farmers: short sentences, big choices, plain
 * words, one decision per step.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles, Pencil, RotateCcw } from "lucide-react";
import { DOCUMENT_TYPES, MARKETS, PRODUCTS, getProduct } from "@/lib/compliance/catalog";
import { classify } from "@/lib/compliance/hs";
import { resolveRequirements } from "@/lib/compliance/resolver";
import { suggestShipping } from "@/lib/compliance/shipping";
import { saveIntent, loadIntent, clearIntent } from "@/lib/compliance/intent";
import { getStatuses, setStatus, clearAllStatuses, type StatusMap } from "@/lib/compliance/status";
import { pushUserState } from "@/lib/supabase/userState";
import { countryName } from "@/lib/public/format";
import { t, useLang } from "@/lib/i18n";
import DocumentChecklist from "@/components/compliance/DocumentChecklist";
import PriceCard from "@/components/sell/PriceCard";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Breadcrumb from "@/components/shell/Breadcrumb";
import { useToast } from "@/components/shell/Toast";
import Reveal from "@/components/motion/Reveal";
import { stepTransition, hoverLift } from "@/lib/motion/variants";
import type { DocStatus, Market, SaleIntent } from "@/lib/compliance/types";

const ORIGINS = ["LK", "ID", "VN", "PH", "IN", "KE", "CI", "GH"];

export default function SellPage() {
  const lang = useLang();
  const { toast } = useToast();
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

  const onSetStatus = (documentTypeId: string, status: DocStatus) => {
    if (intent) {
      setStatuses(setStatus(intent, documentTypeId, status));
      pushUserState();
    }
  };

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
    setStep(1);
    toast(t(lang, "toast_reset"), "success");
  };

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-6 sm:px-8">
      <Reveal>
        <header className="mb-5">
          <Breadcrumb items={[{ label: t(lang, "nav_home"), href: "/" }, { label: t(lang, "nav_sell") }]} />
          <div className="mb-2 mt-3 flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{t(lang, "sell_title")}</h1>
            <LanguageSwitcher />
          </div>
          <p className="text-sm muted">{t(lang, "sell_sub")}</p>
        </header>
      </Reveal>

      {committed && step < 5 && (
        <button
          onClick={() => setStep(5)}
          className="mb-3 inline-flex items-center gap-1 self-start text-sm faint hover:underline underline-offset-2"
        >
          <ArrowLeft size={15} /> {t(lang, "back")}
        </button>
      )}
      {step < 5 && <Steps step={step} />}

      <AnimatePresence mode="wait">
      {/* 1. product */}
      {step === 1 && (
        <motion.div key={1} variants={stepTransition} initial="initial" animate="enter" exit="exit">
        <Card title={t(lang, "q_product")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRODUCTS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProductId(p.id);
                  setStep(2);
                }}
                className={`tile ${productId === p.id ? "tile-active" : ""}`}
              >
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs faint">HS {p.hsCode}</div>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label className="label">{t(lang, "q_product_free")}</label>
            <input
              value={hsText}
              onChange={(e) => setHsText(e.target.value)}
              placeholder={t(lang, "q_product_placeholder")}
              className="field"
            />
            {hsCandidates.length > 0 && (
              <ul className="mt-2 space-y-2">
                {hsCandidates.map((c) => (
                  <li key={c.productId}>
                    <button
                      onClick={() => {
                        setProductId(c.productId);
                        setStep(2);
                      }}
                      className="tile w-full"
                    >
                      <span className="font-medium">{c.name}</span> · HS {c.hsCode}{" "}
                      <span className="text-xs faint">({Math.round(c.score * 100)}% match)</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        </motion.div>
      )}

      {/* 2. origin */}
      {step === 2 && (
        <motion.div key={2} variants={stepTransition} initial="initial" animate="enter" exit="exit">
        <Card title={t(lang, "q_origin")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ORIGINS.map((c) => (
              <Choice
                key={c}
                active={origin === c}
                label={countryName(c)}
                onClick={() => {
                  setOrigin(c);
                  setStep(3);
                }}
              />
            ))}
          </div>
          <Back onClick={() => setStep(1)} />
        </Card>
        </motion.div>
      )}

      {/* 3. destination */}
      {step === 3 && (
        <motion.div key={3} variants={stepTransition} initial="initial" animate="enter" exit="exit">
        <Card title={t(lang, "q_market")}>
          <div className="grid gap-2">
            {MARKETS.map((m) => (
              <button
                key={m.code}
                onClick={() => {
                  setDestination(m.code);
                  setStep(4);
                }}
                className={`tile ${destination === m.code ? "tile-active" : ""}`}
              >
                <div className="font-semibold">{m.name}</div>
                <div className="text-xs faint">{m.note}</div>
              </button>
            ))}
          </div>
          <Back onClick={() => setStep(2)} />
        </Card>
        </motion.div>
      )}

      {/* 4. details */}
      {step === 4 && (
        <motion.div key={4} variants={stepTransition} initial="initial" animate="enter" exit="exit">
        <Card title={t(lang, "q_details")}>
          <label className="label" htmlFor="qty">{t(lang, "qty_label")}</label>
          <input
            id="qty"
            inputMode="numeric"
            value={quantityKg}
            onChange={(e) => setQuantityKg(e.target.value)}
            placeholder={t(lang, "qty_placeholder")}
            className="field"
          />
          <label className="mt-4 flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={organic}
              onChange={(e) => setOrganic(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
            {t(lang, "organic_label")}
          </label>
          <motion.div {...hoverLift}>
            <button onClick={goResults} className="btn btn-primary mt-5 w-full">
              {t(lang, "show_btn")} <ArrowRight size={16} />
            </button>
          </motion.div>
          <Back onClick={() => setStep(3)} />
        </Card>
        </motion.div>
      )}

      {/* 5. results */}
      {step === 5 && result && product && destination && (
        <motion.div key={5} variants={stepTransition} initial="initial" animate="enter" exit="exit" className="flex flex-col gap-5">
          <div className="glass-card p-4 text-sm" style={{ borderColor: "var(--accent)" }}>
            <Sparkles size={15} className="mb-1.5 inline-block" style={{ color: "var(--accent)" }} />{" "}
            {t(lang, "summary", {
              product: `${product.name} (HS ${product.hsCode})`,
              origin: countryName(origin!),
              dest: destination,
              total: result.summary.total,
              self: result.summary.selfServe,
              auth: result.summary.authority,
            })}
          </div>

          <PriceCard productId={product.id} quantityKg={Number(quantityKg) || undefined} />

          <DocumentChecklist documents={result.documents} statuses={statuses} onSetStatus={onSetStatus} />

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide faint">{t(lang, "shipping_title")}</h2>
            <div className="flex flex-col gap-3">
              {shipping.map((s) => (
                <div key={s.mode} className="glass-card p-4 text-sm">
                  <div className="font-semibold">{s.label}</div>
                  <p className="mt-0.5 muted">{s.rationale}</p>
                  <p className="mt-1 text-xs faint">
                    Suggested terms: {s.incoterm} · transit {s.transit}
                  </p>
                  <p className="text-xs faint">{s.notes}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="tag tag-warn !block !rounded-xl p-3 text-xs">{t(lang, "disclaimer")}</p>
          {lang !== "en" && (
            <p className="glass p-3 text-xs muted">{t(lang, "docs_in_english")}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={changeInfo} className="btn btn-ghost btn-sm">
              <Pencil size={14} /> {t(lang, "sell_change")}
            </button>
            {resetArmed ? (
              <button
                onClick={resetInfo}
                className="btn btn-sm"
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                <RotateCcw size={14} /> {t(lang, "sell_reset_confirm")}
              </button>
            ) : (
              <button
                onClick={() => {
                  setResetArmed(true);
                  setTimeout(() => setResetArmed(false), 4000);
                }}
                className="text-sm faint underline underline-offset-2"
              >
                {t(lang, "sell_reset")}
              </button>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </main>
  );
}

function Steps({ step }: { step: number }) {
  return (
    <div className="mb-5 flex gap-1.5" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className="h-1.5 flex-1 rounded-full transition-colors"
          style={{ background: n <= step ? "var(--accent)" : "var(--glass-border-2)" }}
        />
      ))}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Choice({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`tile ${active ? "tile-active" : ""}`}>
      {label}
    </button>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  const lang = useLang();
  return (
    <button onClick={onClick} className="mt-4 inline-flex items-center gap-1 text-sm faint hover:underline underline-offset-2">
      <ArrowLeft size={15} />
      {t(lang, "back")}
    </button>
  );
}
