"use client";

/**
 * The new front door: a farmer answers what they grow, where they are, where
 * they want to sell, and how much — and gets the exact documents they need to
 * export legally and sell direct, plus shipping options. Written for both
 * tech-comfortable and traditional farmers: short sentences, big choices, plain
 * words, one decision per step.
 */
import { useEffect, useMemo, useState } from "react";
import { DOCUMENT_TYPES, MARKETS, PRODUCTS, getProduct } from "@/lib/compliance/catalog";
import { classify } from "@/lib/compliance/hs";
import { resolveRequirements } from "@/lib/compliance/resolver";
import { suggestShipping } from "@/lib/compliance/shipping";
import { saveIntent } from "@/lib/compliance/intent";
import { getStatuses, setStatus, type StatusMap } from "@/lib/compliance/status";
import { countryName } from "@/lib/public/format";
import { t, useLang } from "@/lib/i18n";
import DocumentChecklist from "@/components/compliance/DocumentChecklist";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { DocStatus, Market, SaleIntent } from "@/lib/compliance/types";

const ORIGINS = ["LK", "ID", "VN", "PH", "IN", "KE", "CI", "GH"];

export default function SellPage() {
  const lang = useLang();
  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState<string | null>(null);
  const [hsText, setHsText] = useState("");
  const [origin, setOrigin] = useState<string | null>(null);
  const [destination, setDestination] = useState<Market | null>(null);
  const [quantityKg, setQuantityKg] = useState<string>("");
  const [organic, setOrganic] = useState(false);
  const [statuses, setStatuses] = useState<StatusMap>({});

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
    if (intent) setStatuses(setStatus(intent, documentTypeId, status));
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
      setStep(5);
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-4">
      <header className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t(lang, "sell_title")}</h1>
          <LanguageSwitcher />
        </div>
        <p className="text-sm text-gray-500">{t(lang, "sell_sub")}</p>
      </header>

      {step < 5 && <Steps step={step} />}

      {/* 1. product */}
      {step === 1 && (
        <Card title={t(lang, "q_product")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRODUCTS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProductId(p.id);
                  setStep(2);
                }}
                className={`rounded-lg border p-3 text-left text-sm ${
                  productId === p.id ? "border-green-600 bg-green-50" : "border-gray-200"
                }`}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-500">HS {p.hsCode}</div>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <label className="text-sm text-gray-600">{t(lang, "q_product_free")}</label>
            <input
              value={hsText}
              onChange={(e) => setHsText(e.target.value)}
              placeholder="e.g. dried arabica coffee beans"
              className="mt-1 w-full rounded border px-3 py-2"
            />
            {hsCandidates.length > 0 && (
              <ul className="mt-2 space-y-1">
                {hsCandidates.map((c) => (
                  <li key={c.productId}>
                    <button
                      onClick={() => {
                        setProductId(c.productId);
                        setStep(2);
                      }}
                      className="w-full rounded border border-gray-200 p-2 text-left text-sm hover:border-green-500"
                    >
                      {c.name} · HS {c.hsCode}{" "}
                      <span className="text-xs text-gray-400">
                        ({Math.round(c.score * 100)}% match)
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      {/* 2. origin */}
      {step === 2 && (
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
      )}

      {/* 3. destination */}
      {step === 3 && (
        <Card title={t(lang, "q_market")}>
          <div className="grid gap-2">
            {MARKETS.map((m) => (
              <button
                key={m.code}
                onClick={() => {
                  setDestination(m.code);
                  setStep(4);
                }}
                className={`rounded-lg border p-3 text-left ${
                  destination === m.code ? "border-green-600 bg-green-50" : "border-gray-200"
                }`}
              >
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-gray-500">{m.note}</div>
              </button>
            ))}
          </div>
          <Back onClick={() => setStep(2)} />
        </Card>
      )}

      {/* 4. details */}
      {step === 4 && (
        <Card title={t(lang, "q_details")}>
          <label className="block text-sm">
            {t(lang, "qty_label")}
            <input
              inputMode="numeric"
              value={quantityKg}
              onChange={(e) => setQuantityKg(e.target.value)}
              placeholder="e.g. 2000"
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={organic} onChange={(e) => setOrganic(e.target.checked)} />
            {t(lang, "organic_label")}
          </label>
          <button
            onClick={goResults}
            className="mt-4 w-full rounded bg-green-600 px-4 py-3 font-medium text-white"
          >
            {t(lang, "show_btn")}
          </button>
          <Back onClick={() => setStep(3)} />
        </Card>
      )}

      {/* 5. results */}
      {step === 5 && result && product && destination && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-green-600 bg-green-50 p-3 text-sm">
            {t(lang, "summary", {
              product: `${product.name} (HS ${product.hsCode})`,
              origin: countryName(origin!),
              dest: destination,
              total: result.summary.total,
              self: result.summary.selfServe,
              auth: result.summary.authority,
            })}
          </div>

          <DocumentChecklist documents={result.documents} statuses={statuses} onSetStatus={onSetStatus} />

          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">{t(lang, "shipping_title")}</h2>
            <div className="flex flex-col gap-2">
              {shipping.map((s) => (
                <div key={s.mode} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="font-medium">{s.label}</div>
                  <p className="text-gray-600">{s.rationale}</p>
                  <p className="text-xs text-gray-500">
                    Suggested terms: {s.incoterm} · transit {s.transit}
                  </p>
                  <p className="text-xs text-gray-500">{s.notes}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">{t(lang, "disclaimer")}</p>
          {lang !== "en" && (
            <p className="rounded bg-gray-50 p-2 text-xs text-gray-600">{t(lang, "docs_in_english")}</p>
          )}

          <button onClick={() => setStep(1)} className="text-sm text-gray-500 underline">
            {t(lang, "start_over")}
          </button>
        </div>
      )}
    </main>
  );
}

function Steps({ step }: { step: number }) {
  return (
    <div className="mb-4 flex gap-1">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className={`h-1.5 flex-1 rounded ${n <= step ? "bg-green-600" : "bg-gray-200"}`}
        />
      ))}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Choice({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-3 text-left text-sm ${
        active ? "border-green-600 bg-green-50" : "border-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  const lang = useLang();
  return (
    <button onClick={onClick} className="mt-3 text-sm text-gray-500 underline">
      {t(lang, "back")}
    </button>
  );
}
